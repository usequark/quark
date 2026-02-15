-- Add expires index to Session for efficient cleanup queries
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- Add expires index to VerificationToken for efficient cleanup queries
CREATE INDEX "VerificationToken_expires_idx" ON "VerificationToken"("expires");

-- Add compound index on Job for efficient queue polling (status + runAt)
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");
