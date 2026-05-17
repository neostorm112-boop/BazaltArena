-- Allow per-sprint scoping of achievements (sprint_winner can be re-assigned when leaderboard changes).
-- Non-sprint-bound achievements use an empty sprintId so the compound unique works as
-- "at most one row per (user, achievement, sprintId)" — Postgres treats NULLs as distinct,
-- so we deliberately use '' instead of NULL.

-- 1. Add column with default ''.
ALTER TABLE "UserAchievement"
  ADD COLUMN "sprintId" TEXT NOT NULL DEFAULT '';

-- 2. Drop the old (userId, achievementId) unique — it would prevent the same user from
-- winning multiple sprints and would conflict with the new compound key.
DROP INDEX IF EXISTS "UserAchievement_userId_achievementId_key";

-- 3. New compound unique. Works for both sprint-bound and non-sprint-bound rows.
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_sprintId_key"
  ON "UserAchievement" ("userId", "achievementId", "sprintId");
