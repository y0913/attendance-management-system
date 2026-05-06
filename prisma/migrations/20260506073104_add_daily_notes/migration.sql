-- CreateTable
CREATE TABLE "daily_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "jst_date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_notes_user_id_jst_date_idx" ON "daily_notes"("user_id", "jst_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_notes_user_id_jst_date_key" ON "daily_notes"("user_id", "jst_date");

-- AddForeignKey
ALTER TABLE "daily_notes" ADD CONSTRAINT "daily_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
