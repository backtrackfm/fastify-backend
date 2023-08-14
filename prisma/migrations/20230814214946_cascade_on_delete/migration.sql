-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Preview" DROP CONSTRAINT "Preview_versionName_branchName_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Version" DROP CONSTRAINT "Version_branchName_projectId_fkey";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_branchName_projectId_fkey" FOREIGN KEY ("branchName", "projectId") REFERENCES "Branch"("name", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preview" ADD CONSTRAINT "Preview_versionName_branchName_projectId_fkey" FOREIGN KEY ("versionName", "branchName", "projectId") REFERENCES "Version"("name", "branchName", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;
