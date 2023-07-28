/*
  Warnings:

  - The primary key for the `Branch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Branch` table. All the data in the column will be lost.
  - You are about to drop the column `versionId` on the `Preview` table. All the data in the column will be lost.
  - The primary key for the `Version` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `branchId` on the `Version` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Version` table. All the data in the column will be lost.
  - Added the required column `branchName` to the `Preview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `Preview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `versionName` to the `Preview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchName` to the `Version` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Preview" DROP CONSTRAINT "Preview_versionId_fkey";

-- DropForeignKey
ALTER TABLE "Version" DROP CONSTRAINT "Version_branchId_fkey";

-- AlterTable
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Branch_pkey" PRIMARY KEY ("name", "projectId");

-- AlterTable
ALTER TABLE "Preview" DROP COLUMN "versionId",
ADD COLUMN     "branchName" TEXT NOT NULL,
ADD COLUMN     "projectId" TEXT NOT NULL,
ADD COLUMN     "versionName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Version" DROP CONSTRAINT "Version_pkey",
DROP COLUMN "branchId",
DROP COLUMN "id",
ADD COLUMN     "branchName" TEXT NOT NULL,
ADD COLUMN     "projectId" TEXT NOT NULL,
ADD CONSTRAINT "Version_pkey" PRIMARY KEY ("name", "branchName", "projectId");

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_branchName_projectId_fkey" FOREIGN KEY ("branchName", "projectId") REFERENCES "Branch"("name", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preview" ADD CONSTRAINT "Preview_versionName_branchName_projectId_fkey" FOREIGN KEY ("versionName", "branchName", "projectId") REFERENCES "Version"("name", "branchName", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
