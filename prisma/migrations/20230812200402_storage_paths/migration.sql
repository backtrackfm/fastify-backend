/*
  Warnings:

  - You are about to drop the column `fileURL` on the `Preview` table. All the data in the column will be lost.
  - You are about to drop the column `coverArtURL` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `projectFilesURL` on the `Version` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Preview" DROP COLUMN "fileURL",
ADD COLUMN     "storagePath" TEXT;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "coverArtURL",
ADD COLUMN     "coverArtStoragePath" TEXT;

-- AlterTable
ALTER TABLE "Version" DROP COLUMN "projectFilesURL",
ADD COLUMN     "filesStoragePath" TEXT;
