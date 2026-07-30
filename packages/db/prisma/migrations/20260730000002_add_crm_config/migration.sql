-- CreateTable
CREATE TABLE "CrmConfig" (
    "id" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL DEFAULT 'Deal',
    "entityPlural" TEXT NOT NULL DEFAULT 'Deals',
    "containerLabel" TEXT NOT NULL DEFAULT 'Company',
    "containerPlural" TEXT NOT NULL DEFAULT 'Companies',
    "actorLabel" TEXT NOT NULL DEFAULT 'Contact',
    "actorPlural" TEXT NOT NULL DEFAULT 'Contacts',
    "pipelineStages" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "defaultPageSize" INTEGER NOT NULL DEFAULT 25,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConfig_pkey" PRIMARY KEY ("id")
);
