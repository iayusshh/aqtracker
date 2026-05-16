/**
 * Drizzle-inferred types for every table in the AtomQuest Goal Tracker schema.
 *
 * Two flavours per table:
 *  - `Select*`  — shape returned by SELECT queries (all columns, nullables
 *                 honoured). Use these in API response types and server-side
 *                 data-loading functions.
 *  - `Insert*`  — shape accepted by INSERT (generated columns are optional,
 *                 server defaults omitted). Use these in form submission
 *                 handlers and seed scripts.
 *
 * Import from this module across the app instead of raw drizzle schema
 * references to keep domain code decoupled from ORM internals.
 *
 * @example
 * import type { SelectGoal, GoalWithRelations } from "@/types";
 */

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  goalCycles,
  goals,
  quarterlyAchievements,
  managerCheckins,
  auditLog,
  escalationRules,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type SelectUser = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

/**
 * Lightweight profile safe to send to the client.
 * Excludes server-only fields like createdAt/updatedAt that bloat payloads.
 */
export type UserProfile = Pick<
  SelectUser,
  "id" | "email" | "fullName" | "role" | "department" | "managerId" | "isActive"
>;

// ---------------------------------------------------------------------------
// Goal Cycles
// ---------------------------------------------------------------------------

export type SelectGoalCycle = InferSelectModel<typeof goalCycles>;
export type InsertGoalCycle = InferInsertModel<typeof goalCycles>;

/** Compact cycle reference embedded in goal responses. */
export type GoalCycleSummary = Pick<
  SelectGoalCycle,
  "id" | "name" | "year" | "phase" | "status"
>;

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type SelectGoal = InferSelectModel<typeof goals>;
export type InsertGoal = InferInsertModel<typeof goals>;

/** Goal enriched with related data — returned by GET /api/goals/[id]. */
export type GoalWithRelations = SelectGoal & {
  employee: UserProfile;
  cycle: GoalCycleSummary;
  quarterlyAchievements: SelectQuarterlyAchievement[];
  managerCheckins: SelectManagerCheckin[];
};

/**
 * Compact goal summary used in list endpoints where loading all relations
 * for every row would be expensive.
 */
export type GoalSummary = Pick<
  SelectGoal,
  | "id"
  | "employeeId"
  | "cycleId"
  | "thrustArea"
  | "title"
  | "uomType"
  | "target"
  | "weightage"
  | "status"
  | "isShared"
  | "createdAt"
  | "updatedAt"
> & {
  employee: Pick<UserProfile, "id" | "fullName" | "department">;
  cycle: GoalCycleSummary;
};

// ---------------------------------------------------------------------------
// Quarterly Achievements
// ---------------------------------------------------------------------------

export type SelectQuarterlyAchievement = InferSelectModel<
  typeof quarterlyAchievements
>;
export type InsertQuarterlyAchievement = InferInsertModel<
  typeof quarterlyAchievements
>;

// ---------------------------------------------------------------------------
// Manager Check-ins
// ---------------------------------------------------------------------------

export type SelectManagerCheckin = InferSelectModel<typeof managerCheckins>;
export type InsertManagerCheckin = InferInsertModel<typeof managerCheckins>;

/** Check-in enriched with manager name — used in goal detail views. */
export type ManagerCheckinWithUser = SelectManagerCheckin & {
  manager: Pick<UserProfile, "id" | "fullName">;
};

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export type SelectAuditLog = InferSelectModel<typeof auditLog>;
export type InsertAuditLog = InferInsertModel<typeof auditLog>;

/** Audit log entry enriched with the actor's name. */
export type AuditLogWithUser = SelectAuditLog & {
  changedByUser: Pick<UserProfile, "id" | "fullName" | "role">;
};

// ---------------------------------------------------------------------------
// Escalation Rules
// ---------------------------------------------------------------------------

export type SelectEscalationRule = InferSelectModel<typeof escalationRules>;
export type InsertEscalationRule = InferInsertModel<typeof escalationRules>;

// ---------------------------------------------------------------------------
// Enum value unions
// Derived from DB enums so conditionals and switch statements are type-safe
// without importing pgEnum values at runtime.
// ---------------------------------------------------------------------------

export type Role = SelectUser["role"];
export type CyclePhase = SelectGoalCycle["phase"];
export type CycleStatus = SelectGoalCycle["status"];
export type UomType = SelectGoal["uomType"];
export type GoalStatus = SelectGoal["status"];
export type Quarter = SelectQuarterlyAchievement["quarter"];
export type AchievementStatus = SelectQuarterlyAchievement["status"];
export type ChangeType = SelectAuditLog["changeType"];
export type EscalationRuleType = SelectEscalationRule["ruleType"];

// ---------------------------------------------------------------------------
// Escalation notification chain shape (stored in jsonb column)
// ---------------------------------------------------------------------------

/**
 * One step in an escalation rule's notification_chain array.
 *
 * @example
 * [
 *   { role: "manager", delayHours: 0 },
 *   { role: "admin",   delayHours: 48, additionalUserIds: ["uuid-hr-bp"] }
 * ]
 */
export interface NotificationChainEntry {
  /** Notify all users with this role. */
  role: Role;
  /** Fire this step N hours after trigger_days threshold is crossed. */
  delayHours: number;
  /** Optionally notify specific users regardless of role. */
  additionalUserIds?: string[];
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
