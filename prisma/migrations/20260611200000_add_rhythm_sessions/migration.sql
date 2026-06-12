-- CreateTable
CREATE TABLE "RhythmSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RhythmSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RhythmSession_userId_startedAt_idx" ON "RhythmSession"("userId", "startedAt");
CREATE INDEX "RhythmSession_userId_type_startedAt_idx" ON "RhythmSession"("userId", "type", "startedAt");

-- AddForeignKey
ALTER TABLE "RhythmSession" ADD CONSTRAINT "RhythmSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
