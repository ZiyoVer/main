CREATE TYPE "TestType" AS ENUM ('REGULAR', 'DTM_BLOCK', 'MILLIY_SERTIFIKAT');

CREATE TYPE "DtmBlockType" AS ENUM (
    'GENERIC',
    'MANDATORY_LANGUAGE',
    'MANDATORY_MATH',
    'MANDATORY_HISTORY',
    'SPECIALTY_1',
    'SPECIALTY_2'
);

ALTER TABLE "Test"
    ADD COLUMN "subject2" TEXT,
    ADD COLUMN "testType_new" "TestType" NOT NULL DEFAULT 'REGULAR';

UPDATE "Test"
SET "testType_new" = CASE
    WHEN "testType" = 'dtm' THEN 'DTM_BLOCK'::"TestType"
    WHEN "testType" = 'milliy_sertifikat' THEN 'MILLIY_SERTIFIKAT'::"TestType"
    ELSE 'REGULAR'::"TestType"
END;

ALTER TABLE "Test" DROP COLUMN "testType";
ALTER TABLE "Test" RENAME COLUMN "testType_new" TO "testType";

ALTER TABLE "TestQuestion"
    ADD COLUMN "blockType" "DtmBlockType" NOT NULL DEFAULT 'GENERIC',
    ADD COLUMN "coefficient" DOUBLE PRECISION;

UPDATE "TestQuestion" AS tq
SET "coefficient" = CASE
    WHEN t."testType" = 'DTM_BLOCK'::"TestType" AND tq."coefficient" IS NULL THEN
        CASE
            WHEN lower(COALESCE(t."subject", '')) IN ('ona tili', 'matematika', 'o''zbekiston tarixi') THEN 1.1
            ELSE 3.1
        END
    ELSE tq."coefficient"
END
FROM "Test" AS t
WHERE t."id" = tq."testId";

ALTER TABLE "TestAttempt"
    ADD COLUMN "rawScore" DOUBLE PRECISION,
    ADD COLUMN "scoreMax" DOUBLE PRECISION,
    ADD COLUMN "grade" TEXT;

UPDATE "TestAttempt" AS ta
SET
    "rawScore" = ta."score",
    "scoreMax" = CASE
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" THEN 75
        ELSE 100
    END,
    "grade" = CASE
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 70 THEN 'A+'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 65 THEN 'A'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 60 THEN 'B+'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 55 THEN 'B'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 50 THEN 'C+'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" AND ta."score" >= 46 THEN 'C'
        WHEN t."testType" = 'MILLIY_SERTIFIKAT'::"TestType" THEN 'D'
        ELSE NULL
    END
FROM "Test" AS t
WHERE t."id" = ta."testId";
