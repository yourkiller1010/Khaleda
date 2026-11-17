-- CreateTable
CREATE TABLE "AutomationActionCheckpoint" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "actionIndex" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionHash" TEXT NOT NULL,
    "outcome" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationActionCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationActionCheckpoint_executionId_createdAt_idx" ON "AutomationActionCheckpoint"("executionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationActionCheckpoint_executionId_actionIndex_key" ON "AutomationActionCheckpoint"("executionId", "actionIndex");

-- AddForeignKey
ALTER TABLE "AutomationActionCheckpoint" ADD CONSTRAINT "AutomationActionCheckpoint_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
