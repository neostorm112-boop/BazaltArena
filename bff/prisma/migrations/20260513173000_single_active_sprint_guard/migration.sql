-- Guarantee at most one active sprint in database.
-- Step 1: normalize existing rows if multiple active flags exist.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN "published" = true THEN 0 ELSE 1 END,
        CASE WHEN "archived" = false THEN 0 ELSE 1 END,
        "updatedAt" DESC,
        "createdAt" DESC
    ) AS rn
  FROM "Sprint"
  WHERE "active" = true
)
UPDATE "Sprint" s
SET "active" = false
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Step 2: hard DB-level guard.
CREATE UNIQUE INDEX IF NOT EXISTS "Sprint_single_active_true_unique"
ON "Sprint" ("active")
WHERE "active" = true;
