/*
  Warnings:

  - Added the required column `profilePic` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "profilePic" TEXT NOT NULL;

-- DropEnum
DROP TYPE "Type";

-- CreateTable
CREATE TABLE "RideInfo" (
    "id" SERIAL NOT NULL,
    "rideID" INTEGER NOT NULL,
    "Date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "riderId" INTEGER NOT NULL,
    "startPoint" TEXT NOT NULL,
    "endPoint" TEXT NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "distTravelled" INTEGER NOT NULL,

    CONSTRAINT "RideInfo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RideInfo" ADD CONSTRAINT "RideInfo_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
