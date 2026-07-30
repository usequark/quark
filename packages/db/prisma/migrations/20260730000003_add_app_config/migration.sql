-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- Migrate data from CrmConfig if it exists, then drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CrmConfig'
  ) THEN
    INSERT INTO "AppConfig" ("id", "key", "value", "updatedAt", "createdAt")
    SELECT
      gen_random_uuid()::text,
      'crm',
      jsonb_build_object(
        'entityLabel', "entityLabel",
        'entityPluralLabel', "entityPlural",
        'containerLabel', "containerLabel",
        'containerPluralLabel', "containerPlural",
        'actorLabel', "actorLabel",
        'actorPluralLabel', "actorPlural",
        'pipelineStages', "pipelineStages",
        'currency', "currency",
        'locale', "locale",
        'defaultPageSize', "defaultPageSize",
        'fields', "fields"
      ),
      "createdAt",
      "updatedAt"
    FROM "CrmConfig";

    DROP TABLE "CrmConfig";
  END IF;
END $$;
