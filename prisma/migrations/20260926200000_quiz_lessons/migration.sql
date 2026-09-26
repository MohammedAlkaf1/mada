-- Quiz lessons inside modules, graded or practice.
ALTER TABLE "Lesson" ADD COLUMN "graded" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lesson" ADD COLUMN "passPercent" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "Lesson" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Lesson" ADD COLUMN "timeLimitMinutes" INTEGER;

-- Questions belong to the final exam (lessonId null) or to a quiz lesson; written answers.
ALTER TABLE "Question" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "Question" ADD COLUMN "guide" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Question" ALTER COLUMN "correct" SET DEFAULT '';

-- Attempts are numbered per quiz, and a written answer waits for review.
ALTER TABLE "QuizAttempt" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'final';
ALTER TABLE "QuizAttempt" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Open';
ALTER TABLE "QuizAttempt" ADD COLUMN "review" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "QuizAttempt" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "reviewedAt" TIMESTAMP(3);
UPDATE "QuizAttempt" SET "status" = 'Graded' WHERE "submittedAt" IS NOT NULL;
DROP INDEX "QuizAttempt_enrollmentId_number_key";
CREATE UNIQUE INDEX "QuizAttempt_enrollmentId_scope_number_key" ON "QuizAttempt"("enrollmentId", "scope", "number");
CREATE INDEX "QuizAttempt_tenantId_status_idx" ON "QuizAttempt"("tenantId", "status");
