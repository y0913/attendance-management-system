-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'approver', 'general');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('monthly', 'hourly');

-- CreateEnum
CREATE TYPE "MidMonthRateChangeStrategy" AS ENUM ('daily', 'month_end');

-- CreateEnum
CREATE TYPE "TimeClockType" AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');

-- CreateEnum
CREATE TYPE "TimeClockSource" AS ENUM ('web', 'manual_correction');

-- CreateEnum
CREATE TYPE "DailyAttendanceStatus" AS ENUM ('resolved', 'missing_clock_out', 'missing_clock_in', 'no_record');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'withdrawn', 'returned');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('submit', 'approve', 'reject', 'withdraw', 'return');

-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('clock_correction', 'leave_request');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('annual');

-- CreateEnum
CREATE TYPE "LeaveGrantSource" AS ENUM ('legal_auto', 'manual');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "closing_day" INTEGER NOT NULL DEFAULT 0,
    "mid_month_rate_change_strategy" "MidMonthRateChangeStrategy" NOT NULL DEFAULT 'month_end',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "company_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'general',
    "manager_id" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'monthly',
    "hired_at" DATE,
    "base_salary" INTEGER,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_rule_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "daily_ot_threshold_min" INTEGER NOT NULL DEFAULT 480,
    "weekly_ot_threshold_min" INTEGER NOT NULL DEFAULT 2400,
    "ot_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.25,
    "night_start_time" TEXT NOT NULL DEFAULT '22:00',
    "night_end_time" TEXT NOT NULL DEFAULT '05:00',
    "night_rate_addition" DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "legal_holiday_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.35,
    "monthly_60h_ot_rate" DECIMAL(5,4) NOT NULL DEFAULT 1.5,
    "monthly_60h_threshold_min" INTEGER NOT NULL DEFAULT 3600,
    "compliance_mode" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "work_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "type" "TimeClockType" NOT NULL,
    "source" "TimeClockSource" NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_attendances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "DailyAttendanceStatus" NOT NULL,
    "clock_in_at" TIMESTAMP(3),
    "clock_out_at" TIMESTAMP(3),
    "break_minutes" INTEGER,
    "work_minutes" INTEGER,
    "ot_minutes" INTEGER,
    "night_minutes" INTEGER,
    "ot_night_minutes" INTEGER,
    "legal_holiday_flag" BOOLEAN NOT NULL DEFAULT false,
    "recalculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_correction_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "current_approver_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "before_payload" JSONB NOT NULL,
    "after_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clock_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "current_approver_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL DEFAULT 'annual',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" DECIMAL(4,1) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "request_type" "ApprovalRequestType" NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_at" DATE NOT NULL,
    "expires_at" DATE NOT NULL,
    "granted_days" DECIMAL(4,1) NOT NULL,
    "used_days" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "source" "LeaveGrantSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_closings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "attendance_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "work_rule_versions_company_id_valid_from_idx" ON "work_rule_versions"("company_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "work_rule_versions_company_id_valid_from_key" ON "work_rule_versions"("company_id", "valid_from");

-- CreateIndex
CREATE INDEX "time_clocks_user_id_occurred_at_idx" ON "time_clocks"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "daily_attendances_user_id_work_date_idx" ON "daily_attendances"("user_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_attendances_user_id_work_date_key" ON "daily_attendances"("user_id", "work_date");

-- CreateIndex
CREATE INDEX "clock_correction_requests_requester_id_status_idx" ON "clock_correction_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "clock_correction_requests_current_approver_id_status_idx" ON "clock_correction_requests"("current_approver_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_requester_id_status_idx" ON "leave_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_current_approver_id_status_idx" ON "leave_requests"("current_approver_id", "status");

-- CreateIndex
CREATE INDEX "approval_actions_request_type_request_id_idx" ON "approval_actions"("request_type", "request_id");

-- CreateIndex
CREATE INDEX "approval_actions_actor_id_created_at_idx" ON "approval_actions"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "leave_grants_user_id_expires_at_idx" ON "leave_grants"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "attendance_closings_company_id_year_month_idx" ON "attendance_closings"("company_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_closings_user_id_year_month_key" ON "attendance_closings"("user_id", "year_month");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rule_versions" ADD CONSTRAINT "work_rule_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rule_versions" ADD CONSTRAINT "work_rule_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clocks" ADD CONSTRAINT "time_clocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_correction_requests" ADD CONSTRAINT "clock_correction_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clock_correction_requests" ADD CONSTRAINT "clock_correction_requests_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_grants" ADD CONSTRAINT "leave_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_closings" ADD CONSTRAINT "attendance_closings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_closings" ADD CONSTRAINT "attendance_closings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_closings" ADD CONSTRAINT "attendance_closings_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
