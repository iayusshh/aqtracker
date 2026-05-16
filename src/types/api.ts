/**
 * API route request/response contracts for the AtomQuest Goal Tracker.
 *
 * These are TypeScript interface definitions only — no runtime implementation.
 * Route handlers in src/app/api/** validate incoming payloads against these
 * shapes (e.g. with zod schemas derived from these interfaces).
 *
 * Conventions:
 *  - Request bodies are `*Request` interfaces.
 *  - Successful responses are `*Response` interfaces.
 *  - All route handler responses are wrapped in `ApiResponse<T>`.
 *  - Timestamps are ISO-8601 strings (JSON-serialised Date).
 *  - UUIDs are plain string (not branded) for simplicity.
 */

import type {
  GoalSummary,
  GoalWithRelations,
  SelectQuarterlyAchievement,
  SelectManagerCheckin,
  AuditLogWithUser,
  Quarter,
  UomType,
  GoalStatus,
  AchievementStatus,
  PaginatedResponse,
  UserProfile,
  GoalCycleSummary,
} from "./index";

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

/**
 * All route handlers return this shape.
 *
 * On success:  { success: true,  data: T }
 * On failure:  { success: false, error: string, code?: string }
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: ApiErrorCode };

/** Machine-readable error codes for programmatic handling on the client. */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "WEIGHTAGE_OVERFLOW"        // sum of goal weightages would exceed 100
  | "CYCLE_WINDOW_CLOSED"       // submission outside the open window
  | "INVALID_STATUS_TRANSITION" // e.g. approve a goal that is not submitted
  | "DUPLICATE_ACHIEVEMENT"     // achievement for (goal, quarter) already exists
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// POST /api/goals
// Create a new goal for the authenticated employee.
// ---------------------------------------------------------------------------

export interface CreateGoalRequest {
  cycleId: string;
  thrustArea: string;
  title: string;
  description?: string;
  uomType: UomType;
  /**
   * Numeric string for numeric/percent, ISO date for timeline, "N/A" for zero.
   * Validated server-side against uomType.
   */
  target: string;
  /**
   * Integer 10–100. Server validates that the running sum for
   * (employeeId, cycleId) does not exceed 100 after addition.
   */
  weightage: number;
}

export interface CreateGoalResponse {
  goal: GoalWithRelations;
  /** Remaining weightage budget for this employee in this cycle. */
  remainingWeightage: number;
}

// ---------------------------------------------------------------------------
// PATCH /api/goals/[id]
// Update a goal that is in draft or returned status.
// Only the goal owner may call this; managers/admins use dedicated actions.
// ---------------------------------------------------------------------------

/** All fields are optional — only supplied fields are updated (PATCH semantics). */
export interface UpdateGoalRequest {
  thrustArea?: string;
  title?: string;
  description?: string;
  uomType?: UomType;
  target?: string;
  weightage?: number;
}

export interface UpdateGoalResponse {
  goal: GoalWithRelations;
  remainingWeightage: number;
}

// ---------------------------------------------------------------------------
// POST /api/goals/[id]/submit
// Employee submits a draft/returned goal for manager approval.
// Goal must be in status 'draft' or 'returned'.
// ---------------------------------------------------------------------------

/** No body required — the goal id is sufficient. */
export type SubmitGoalRequest = Record<string, never>;

export interface SubmitGoalResponse {
  goal: Pick<GoalWithRelations, "id" | "status" | "updatedAt">;
  /** ISO-8601 timestamp of when the submission was recorded. */
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// POST /api/goals/[id]/approve
// Manager approves a submitted goal.
// Caller must be the employee's direct manager or an admin.
// Goal must be in status 'submitted'.
// ---------------------------------------------------------------------------

export interface ApproveGoalRequest {
  /** Optional approval note stored as the first manager check-in for the period. */
  comment?: string;
}

export interface ApproveGoalResponse {
  goal: Pick<GoalWithRelations, "id" | "status" | "updatedAt">;
}

// ---------------------------------------------------------------------------
// POST /api/goals/[id]/return
// Manager returns a submitted goal for rework.
// Goal moves from 'submitted' → 'returned'.
// ---------------------------------------------------------------------------

export interface ReturnGoalRequest {
  /** Required: manager must explain what needs to change. */
  comment: string;
}

export interface ReturnGoalResponse {
  goal: Pick<GoalWithRelations, "id" | "status" | "updatedAt">;
  checkin: SelectManagerCheckin;
}

// ---------------------------------------------------------------------------
// POST /api/goals/[id]/achievement
// Employee logs or updates their quarterly achievement for a goal.
// Creates a quarterly_achievements row (or updates if it already exists via upsert).
// ---------------------------------------------------------------------------

export interface LogAchievementRequest {
  quarter: Quarter;
  actualAchievement: string;
  status: AchievementStatus;
}

export interface LogAchievementResponse {
  achievement: SelectQuarterlyAchievement;
  /**
   * Server-computed score (0–100) based on uomType, target, and
   * actualAchievement. Null if the goal's uomType is 'zero' and tracking
   * is binary (incident occurred or not).
   */
  computedScore: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/goals/[id]/checkin
// Manager adds a quarterly check-in comment on a goal.
// Caller must be the employee's manager or an admin.
// ---------------------------------------------------------------------------

export interface CreateCheckinRequest {
  quarter: Quarter;
  comment: string;
}

export interface CreateCheckinResponse {
  checkin: SelectManagerCheckin;
}

// ---------------------------------------------------------------------------
// GET /api/goals
// List goals visible to the authenticated user, respecting role visibility:
//   employee  → own goals only
//   manager   → own goals + all direct reports' goals
//   admin     → all goals
// ---------------------------------------------------------------------------

export interface ListGoalsQuery {
  /** Filter by cycle. */
  cycleId?: string;
  /** Filter by employee (managers/admins only; employees always see own). */
  employeeId?: string;
  /** Filter by goal status. */
  status?: GoalStatus;
  /** Filter by thrust area (case-insensitive contains match). */
  thrustArea?: string;
  /** Pagination — 1-based page number. Default: 1 */
  page?: number;
  /** Pagination — rows per page. Default: 20, max: 100 */
  pageSize?: number;
}

export type ListGoalsResponse = PaginatedResponse<GoalSummary>;

// ---------------------------------------------------------------------------
// GET /api/reports/achievement
// Achievement report: per-goal, per-quarter computed scores.
// Managers see their team; admins see all; employees see own.
// ---------------------------------------------------------------------------

export interface AchievementReportQuery {
  cycleId: string;
  /** Narrow to a specific employee (managers/admins only). */
  employeeId?: string;
  /** Narrow to a specific quarter. */
  quarter?: Quarter;
}

export interface AchievementReportRow {
  goalId: string;
  goalTitle: string;
  thrustArea: string;
  employee: Pick<UserProfile, "id" | "fullName" | "department">;
  weightage: number;
  uomType: UomType;
  target: string;
  quarter: Quarter;
  actualAchievement: string | null;
  achievementStatus: AchievementStatus | null;
  computedScore: string | null; // numeric string, null if not yet submitted
}

export interface AchievementReportResponse {
  cycle: GoalCycleSummary;
  rows: AchievementReportRow[];
  /**
   * Aggregate: weighted average score across all goals for each employee.
   * Key is employee_id.
   */
  weightedScoreByEmployee: Record<string, number | null>;
}

// ---------------------------------------------------------------------------
// GET /api/reports/completion
// Completion dashboard: how many goals are in each status per cycle.
// ---------------------------------------------------------------------------

export interface CompletionReportQuery {
  cycleId: string;
  /** Narrow to a department. */
  department?: string;
}

export interface CompletionStatusBreakdown {
  draft: number;
  submitted: number;
  approved: number;
  returned: number;
  locked: number;
  total: number;
  /** Percentage of goals in 'approved' or 'locked' status. */
  approvalRate: number;
}

export interface CompletionReportRow {
  employee: Pick<UserProfile, "id" | "fullName" | "department">;
  manager: Pick<UserProfile, "id" | "fullName"> | null;
  goalBreakdown: CompletionStatusBreakdown;
  /** Null until at least one quarter's achievement is submitted. */
  averageComputedScore: number | null;
}

export interface CompletionReportResponse {
  cycle: GoalCycleSummary;
  /** Company-wide totals. */
  aggregate: CompletionStatusBreakdown;
  rows: CompletionReportRow[];
}

// ---------------------------------------------------------------------------
// POST /api/admin/shared-goals
// Admin pushes a "template" goal to one or more employees.
// Creates copies of an existing approved goal (sharedFromGoalId set).
// Admin-only endpoint.
// ---------------------------------------------------------------------------

export interface PushSharedGoalRequest {
  /**
   * The source goal to clone. Must be approved and is_shared = true,
   * or the endpoint will set is_shared = true on the source automatically.
   */
  sourceGoalId: string;
  /** UUIDs of employees who should receive the shared goal. */
  targetEmployeeIds: string[];
  /**
   * The cycle in which the shared goal should be created for the targets.
   * Defaults to the source goal's cycle if omitted.
   */
  targetCycleId?: string;
  /**
   * Allow partial overrides on the cloned goal. If omitted, the clone
   * is identical to the source (title, description, thrust_area, uomType,
   * target, weightage are copied verbatim).
   */
  overrides?: {
    title?: string;
    description?: string;
    weightage?: number;
  };
}

export interface PushSharedGoalResponse {
  /** How many goal records were created. */
  createdCount: number;
  /** IDs of the newly created goal rows. */
  createdGoalIds: string[];
  /** Employee IDs for which creation was skipped (already has the goal). */
  skippedEmployeeIds: string[];
}

// ---------------------------------------------------------------------------
// GET /api/admin/audit-log
// Paginated audit log. Admin-only.
// ---------------------------------------------------------------------------

export interface AuditLogQuery {
  /** Filter to a specific table. */
  tableName?: string;
  /** Filter to a specific record. */
  recordId?: string;
  /** Filter to a specific actor. */
  changedBy?: string;
  /** ISO-8601 date string — return entries on or after this timestamp. */
  from?: string;
  /** ISO-8601 date string — return entries on or before this timestamp. */
  to?: string;
  page?: number;
  pageSize?: number;
}

export type AuditLogResponse = PaginatedResponse<AuditLogWithUser>;
