-- AlterTable
ALTER TABLE "Preview" ALTER COLUMN "fileURL" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Version" ALTER COLUMN "projectFilesURL" DROP NOT NULL;
