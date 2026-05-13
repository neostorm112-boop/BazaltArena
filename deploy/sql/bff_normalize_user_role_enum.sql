-- Привести bff."UserRole" к ADMIN | USER (как в текущей Prisma-схеме).
-- Безопасно no-op, если в enum уже только ADMIN и USER.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'bff'
      AND t.typname = 'UserRole'
      AND e.enumlabel IN ('MEMBER', 'MENTOR')
  ) THEN
    CREATE TYPE bff."UserRole_new" AS ENUM ('ADMIN', 'USER');
    ALTER TABLE bff."User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE bff."User"
      ALTER COLUMN "role" TYPE bff."UserRole_new"
      USING (
        CASE
          WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::bff."UserRole_new"
          ELSE 'USER'::bff."UserRole_new"
        END
      );
    DROP TYPE bff."UserRole";
    ALTER TYPE bff."UserRole_new" RENAME TO "UserRole";
    ALTER TABLE bff."User" ALTER COLUMN "role" SET DEFAULT 'USER'::bff."UserRole";
  END IF;
END
$$;
