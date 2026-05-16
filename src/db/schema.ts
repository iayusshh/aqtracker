import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["employee", "manager", "admin"]);

export const cyclePhaseEnum = pgEnum("cycle_phase", [
  "goal_setting",
  "q1",
  "q2",
  "q3",
  "q4_annual",
]);

export const cycleStatusEnum = pgEnum("cycle_status", [
  "draft",
  "active",
  "closed",
]);

export const uomTypeEnum = pgEnum("uom_type", [
  "min_numeric",
  "max_numeric",
  "min_percent",
  "max_percent",
  "timeline",
  "zero",
]);

export const goalStatusEnum = pgEnum("goal_status", [
  "draft",
  "submitted",
  "approved",
  "returned",
  "locked",
]);

export const quarterEnum = pgEnum("quarter", ["q1", "q2", "q3", "q4"]);

export const achievementStatusEnum = pgEnum("achievement_status", [
  "not_started",
  "on_track",
  "completed",
]);

export const changeTypeEnum = pgEnum("change_type", [
  "insert",
  "update",
  "delete",
]);

export const escalationRuleTypeEnum = pgEnum("escalation_rule_type", [
  "goal_not_submitted",
  "goal_not_approved",
  "checkin_not_done",
]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Mirrors auth.users from Supabase. id is the same UUID issued by Supabase
 * Auth. Populated via a trigger on auth.users INSERT or managed through the
 * admin API.
 *
 * manager_id is a self-referential FK defined without .references() here
 * because Drizzle cannot resolve self-referential FKs at declaration time.
 * The FK constraint is present in the raw SQL migration (001_init.sql).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // mapped 1-to-1 with auth.users(id)
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    role: roleEnum("role").notNull().default("employee"),
    department: text("department"),
    /** Self-referential: points to the user's direct (L1) manager. */
    managerId: uuid("manager_id"), // FK → users.id, enforced in SQL migration
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_manager_id_idx").on(t.managerId)]
);

// ---------------------------------------------------------------------------
// Goal Cycles
// ---------------------------------------------------------------------------

export const goalCycles = pgTable(
  "goal_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    phase: cyclePhaseEnum("phase").notNull(),
    windowOpen: date("window_open").notNull(),
    windowClose: date("window_close").notNull(),
    status: cycleStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("goal_cycles_year_phase_idx").on(t.year, t.phase),
    index("goal_cycles_status_idx").on(t.status),
  ]
);

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => goalCycles.id, { onDelete: "restrict" }),
    thrustArea: text("thrust_area").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    uomType: uomTypeEnum("uom_type").notNull(),
    /**
     * Stores the target value as text to accommodate all uom_type variants:
     *  - min_numeric / max_numeric / min_percent / max_percent: numeric string e.g. "85.5"
     *  - timeline: ISO date string e.g. "2025-03-31"
     *  - zero: literal "N/A"
     */
    target: text("target").notNull(),
    /**
     * Integer 10–100. The sum per (employee_id, cycle_id) must equal 100 —
     * this constraint is enforced at the application layer before INSERT/UPDATE.
     * The DB check below guards only the per-row range.
     */
    weightage: integer("weightage").notNull(),
    status: goalStatusEnum("status").notNull().default("draft"),
    isShared: boolean("is_shared").notNull().default(false),
    /**
     * Self-referential FK. When non-null, this goal was cloned from the
     * referenced goal (admin "push shared goal" feature).
     * Not expressed via .references() to avoid circular dependency ordering
     * issues with drizzle-kit; the constraint exists in 001_init.sql.
     */
    sharedFromGoalId: uuid("shared_from_goal_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("goals_employee_cycle_idx").on(t.employeeId, t.cycleId),
    index("goals_cycle_id_idx").on(t.cycleId),
    index("goals_status_idx").on(t.status),
    check(
      "goals_weightage_range",
      sql`${t.weightage} >= 10 AND ${t.weightage} <= 100`
    ),
  ]
);

// ---------------------------------------------------------------------------
// Quarterly Achievements
// ---------------------------------------------------------------------------

export const quarterlyAchievements = pgTable(
  "quarterly_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    quarter: quarterEnum("quarter").notNull(),
    actualAchievement: text("actual_achievement").notNull(),
    status: achievementStatusEnum("status").notNull().default("not_started"),
    /**
     * Application-computed score (0–100). Calculation depends on uom_type:
     *  - max_numeric/max_percent: (actual / target) * 100, capped at 100
     *  - min_numeric/min_percent: (target / actual) * 100, capped at 100
     *  - timeline: 100 if completed before target date, else 0
     *  - zero: 100 if no incidents, else 0
     * Null until the achievement is submitted.
     */
    computedScore: numeric("computed_score", { precision: 5, scale: 2 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("quarterly_achievements_goal_quarter_unique").on(
      t.goalId,
      t.quarter
    ),
    index("quarterly_achievements_goal_id_idx").on(t.goalId),
  ]
);

// ---------------------------------------------------------------------------
// Manager Check-ins
// ---------------------------------------------------------------------------

export const managerCheckins = pgTable(
  "manager_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    quarter: quarterEnum("quarter").notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("manager_checkins_goal_id_idx").on(t.goalId),
    index("manager_checkins_manager_id_idx").on(t.managerId),
    index("manager_checkins_quarter_idx").on(t.quarter),
  ]
);

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableName: text("table_name").notNull(),
    /** Text so it can hold UUIDs, composite key representations, etc. */
    recordId: text("record_id").notNull(),
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changeType: changeTypeEnum("change_type").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_table_record_idx").on(t.tableName, t.recordId),
    index("audit_log_changed_by_idx").on(t.changedBy),
    index("audit_log_changed_at_idx").on(t.changedAt),
  ]
);

// ---------------------------------------------------------------------------
// Escalation Rules
// ---------------------------------------------------------------------------

export const escalationRules = pgTable(
  "escalation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleType: escalationRuleTypeEnum("rule_type").notNull(),
    triggerDays: integer("trigger_days").notNull(),
    /**
     * Ordered array of notification steps.
     * Shape: Array<{ role: Role; delay_hours: number; additional_user_ids?: string[] }>
     */
    notificationChain: jsonb("notification_chain").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  /** The user's direct (L1) manager. */
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
    relationName: "managerToReports",
  }),
  /** All users who report directly to this user. */
  directReports: many(users, { relationName: "managerToReports" }),
  goals: many(goals),
  checkins: many(managerCheckins),
  createdCycles: many(goalCycles),
}));

export const goalCyclesRelations = relations(goalCycles, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [goalCycles.createdBy],
    references: [users.id],
  }),
  goals: many(goals),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  employee: one(users, {
    fields: [goals.employeeId],
    references: [users.id],
  }),
  cycle: one(goalCycles, {
    fields: [goals.cycleId],
    references: [goalCycles.id],
  }),
  /** The source template goal this was shared from (null if original). */
  sharedFromGoal: one(goals, {
    fields: [goals.sharedFromGoalId],
    references: [goals.id],
    relationName: "sharedGoals",
  }),
  /** Goals derived from this one via the shared-goal push feature. */
  derivedSharedGoals: many(goals, { relationName: "sharedGoals" }),
  quarterlyAchievements: many(quarterlyAchievements),
  managerCheckins: many(managerCheckins),
}));

export const quarterlyAchievementsRelations = relations(
  quarterlyAchievements,
  ({ one }) => ({
    goal: one(goals, {
      fields: [quarterlyAchievements.goalId],
      references: [goals.id],
    }),
  })
);

export const managerCheckinsRelations = relations(
  managerCheckins,
  ({ one }) => ({
    goal: one(goals, {
      fields: [managerCheckins.goalId],
      references: [goals.id],
    }),
    manager: one(users, {
      fields: [managerCheckins.managerId],
      references: [users.id],
    }),
  })
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  changedByUser: one(users, {
    fields: [auditLog.changedBy],
    references: [users.id],
  }),
}));
