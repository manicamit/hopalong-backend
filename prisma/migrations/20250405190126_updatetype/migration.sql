/*
  Warnings:

  - You are about to drop the column `date` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Ride` table. All the data in the column will be lost.
  - Added the required column `start` to the `Ride` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ride" DROP COLUMN "date",
DROP COLUMN "time",
ADD COLUMN     "start" TIMESTAMP(3) NOT NULL;
