-- CreateEnum
CREATE TYPE "LeaveDayUnit" AS ENUM ('full', 'half');

-- AlterTable
ALTER TABLE "clock_correction_requests" ADD COLUMN     "decided_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "day_unit" "LeaveDayUnit" NOT NULL DEFAULT 'full',
ADD COLUMN     "decided_at" TIMESTAMP(3);
