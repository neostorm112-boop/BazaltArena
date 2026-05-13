-- Collapse UserRole to ADMIN + USER (former MEMBER and MENTOR → USER).

CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
      ELSE 'USER'::"UserRole_new"
    END
  );

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole";
