ALTER TABLE "Test"
    ALTER COLUMN "testType" TYPE TEXT USING "testType"::text;

DROP TYPE IF EXISTS "TestType";
