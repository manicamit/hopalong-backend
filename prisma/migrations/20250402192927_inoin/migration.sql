/*
  Warnings:

  - You are about to drop the column `rideID` on the `RideInfo` table. All the data in the column will be lost.
  - Added the required column `rideId` to the `RideInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RideInfo" DROP COLUMN "rideID",
ADD COLUMN     "rideId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "RideInfo_rideId_idx" ON "RideInfo"("rideId");
