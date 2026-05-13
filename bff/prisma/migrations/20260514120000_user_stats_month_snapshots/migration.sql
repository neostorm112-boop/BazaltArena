-- AlterTable: месячные снимки для дельт в карточках профиля (/me)
ALTER TABLE "User" ADD COLUMN "statsMonthKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "pointsAtMonthStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "moneyAtMonthStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "sprintsAcceptedAtMonthStart" INTEGER NOT NULL DEFAULT 0;
