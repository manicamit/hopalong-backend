-- CreateTable
CREATE TABLE "route" (
    "id" SERIAL NOT NULL,
    "creator" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLon" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLon" DOUBLE PRECISION NOT NULL,
    "placesOfInterest" TEXT[],

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);
