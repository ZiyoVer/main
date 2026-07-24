-- PostgreSQL keeps the enum-typed default dependency when the column is cast to text.
-- Drop it before the existing text-compat migration drops the TestType enum.
ALTER TABLE "Test"
ALTER COLUMN "testType" DROP DEFAULT;
