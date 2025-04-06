import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  checkRouteOverlap,
  getAddressFromCoordinates,
  getDistanceBetweenPoints,
  getRoutes,
} from "../utils/routeMatch";
import { getUserIdFromToken } from "../utils/getId";

const prisma = new PrismaClient();

export class RouteController {
  /**
   * Find routes that match with the given route coordinates without writing to the database
   */
  static async findRouteMatch(req: Request, res: Response) {
    try {
      const { token, start, end, startTime } = req.body;

      if (!token || !start || !end || !startTime) {
        res.status(400).json({
          success: false,
          message: "Token, start, end coordinates and start time are required",
        });
        return;
      }

      // Validate coordinates format
      const startCoords = start.split(",").map(Number);
      const endCoords = end.split(",").map(Number);
      if (
        startCoords.length !== 2 ||
        endCoords.length !== 2 ||
        isNaN(startCoords[0]) ||
        isNaN(startCoords[1]) ||
        isNaN(endCoords[0]) ||
        isNaN(endCoords[1])
      ) {
        res.status(400).json({
          success: false,
          message: "Start and end must be valid lat,lon coordinates",
        });
        return;
      }
      // Get user ID from token for filtering out own routes
      const userId = await getUserIdFromToken(token);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid token",
        });
        return;
      }

      // Parse requested start time
      const requestedStartTime = new Date(startTime);
      if (isNaN(requestedStartTime.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid start time format",
        });
        return;
      }

      // Calculate time window for matching (±12 hours)
      const startTimeMin = new Date(requestedStartTime);
      startTimeMin.setHours(startTimeMin.getHours() - 12);
      const startTimeMax = new Date(requestedStartTime);
      startTimeMax.setHours(startTimeMax.getHours() + 12);

      // Fetch only primary routes from the database by querying rides
      const primaryRoutes = await prisma.ride.findMany({
        where: {
          start: {
            gte: startTimeMin,
            lte: startTimeMax,
          },
          primaryRouteId: { not: null },
          // Exclude rides owned by the requesting user
          NOT: { ownerId: userId },
        },
        include: {
          primaryRoute: {
            include: {
              creator: { select: { firstName: true, lastName: true } },
            },
          },
          owner: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (primaryRoutes.length === 0) {
        res.status(200).json({
          success: true,
          matches: [],
          message: "No primary routes found for matching",
        });
        return;
      }

      // Check each primary route for overlap with the new route
      const matchResults = [];
      for (const ride of primaryRoutes) {
        // Skip if no primary route exists (shouldn't happen due to query filter, but for safety)
        if (!ride.primaryRoute) continue;

        // Construct route start/end strings for comparison
        const route = ride.primaryRoute;
        const routeStart = `${route.startLat},${route.startLon}`;
        const routeEnd = `${route.endLat},${route.endLon}`;

        const result = await checkRouteOverlap(
          start,
          end,
          routeStart,
          routeEnd
        );

        if (result.overlap && result.overlapPercentage > 85) {
          matchResults.push({
            ride: ride,
            timeDifference:
              Math.abs(ride.start.getTime() - requestedStartTime.getTime()) /
              (1000 * 60 * 60), // difference in hours
            overlapPercentage: result.overlapPercentage,
            overlapSegmentCount: result.overlapSegmentCount,
          });
        }
      }

      // Sort matches by overlap percentage (highest first)
      matchResults.sort((a, b) => b.overlapPercentage - a.overlapPercentage);

      res.status(200).json({
        success: true,
        matches: matchResults,
        message: `Found ${matchResults.length} matching primary routes within 12 hour time window`,
      });
      return;
    } catch (error) {
      console.error("Error in findRouteMatch:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to find matching routes",
      });
      return;
    }
  }

  /**
   * Create a new route in an existing ride
   */
  static async createRouteinRide(req: Request, res: Response) {
    try {
      const { token, start, end, startTime, rideId } = req.body;

      // Validate required inputs
      if (!token || !start || !end || !startTime || !rideId) {
        res.status(400).json({
          success: false,
          message:
            "Token, start/end coordinates, start time, and ride ID are required",
        });
        return;
      }

      // Validate coordinates format
      const startCoords = start.split(",").map(Number);
      const endCoords = end.split(",").map(Number);
      if (
        startCoords.length !== 2 ||
        endCoords.length !== 2 ||
        isNaN(startCoords[0]) ||
        isNaN(startCoords[1]) ||
        isNaN(endCoords[0]) ||
        isNaN(endCoords[1])
      ) {
        res.status(400).json({
          success: false,
          message: "Start and end must be valid lat,lon coordinates",
        });
        return;
      }

      // Parse and validate start time
      const parsedStartTime = new Date(startTime);
      if (isNaN(parsedStartTime.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid start time format",
        });
        return;
      }

      // Check if token is valid and get user ID
      const userId = await getUserIdFromToken(token);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid token",
        });
        return;
      }

      // Check if ride exists and get its details
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          owner: true,
          members: true,
          primaryRoute: true,
        },
      });

      if (!ride) {
        res.status(404).json({
          success: false,
          message: "Ride not found",
        });
        return;
      }

      // Ensure user is not already owner or member of the ride
      if (
        ride.ownerId === userId ||
        ride.members.some((member) => member.id === userId)
      ) {
        res.status(403).json({
          success: false,
          message: "You are already part of this ride",
        });
        return;
      }

      // Check if ride time is within 12 hours of the requested start time
      const timeDiff = Math.abs(
        ride.start.getTime() - parsedStartTime.getTime()
      );
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff > 12) {
        res.status(400).json({
          success: false,
          message:
            "Your route start time must be within 12 hours of the ride's start time",
          hoursDifference: hoursDiff,
        });
        return;
      }

      // Get place names and calculate distance
      const startPlaceName = await getAddressFromCoordinates(startCoords);
      const endPlaceName = await getAddressFromCoordinates(endCoords);
      if (!startPlaceName || !endPlaceName) {
        res.status(400).json({
          success: false,
          message: "Failed to fetch place names from coordinates",
        });
        return;
      }

      const distance = await getDistanceBetweenPoints(startCoords, endCoords);

      if (distance === null) {
        res.status(400).json({
          success: false,
          message: "Failed to calculate distance between points",
        });
        return;
      }

      // Create the new route
      const newRoute = await prisma.route.create({
        data: {
          creatorId: userId,
          startPlaceName,
          endPlaceName,
          startLat: startCoords[0],
          startLon: startCoords[1],
          endLat: endCoords[0],
          endLon: endCoords[1],
          distance,
        },
      });

      // Check if the new route should be primary (based on distance)
      let updatedRide;
      if (ride.primaryRoute && distance > ride.primaryRoute.distance) {
        // New route becomes primary, old one becomes member
        updatedRide = await prisma.ride.update({
          where: { id: rideId },
          data: {
            primaryRouteId: newRoute.id,
            members: {
              connect: { id: userId }, // Add user as a member
            },
            memberRoutes: {
              connect: { id: ride.primaryRoute.id }, // Old primary becomes a member route
            },
          },
          include: {
            primaryRoute: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            members: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            memberRoutes: true,
          },
        });

        // Update the old primary route to be a member route
        await prisma.route.update({
          where: { id: ride.primaryRoute.id },
          data: { memberRideId: rideId },
        });
      } else {
        // New route becomes a member route
        updatedRide = await prisma.$transaction([
          // Add the user as a member of the ride
          prisma.ride.update({
            where: { id: rideId },
            data: {
              members: {
                connect: { id: userId },
              },
            },
          }),

          // Update the new route to be a member of the ride
          prisma.route.update({
            where: { id: newRoute.id },
            data: { memberRideId: rideId },
          }),

          // Fetch the updated ride with all related data
          prisma.ride.findUnique({
            where: { id: rideId },
            include: {
              primaryRoute: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              members: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              memberRoutes: true,
            },
          }),
        ]);

        // Get the result from the transaction
        updatedRide = updatedRide[2];
      }

      res.status(200).json({
        success: true,
        message: "Route added to ride successfully",
        ride: updatedRide,
        newRoute,
      });
      return;
    } catch (error) {
      console.error("Error in createRouteinRide:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to create route in ride",
      });
    }
  }

  /**
   * Create a new ride with a primary route in the database
   */
  static async createRide(req: Request, res: Response) {
    try {
      const { token, start, end, startTime, totalCost = 0 } = req.body;

      if (!token || !start || !end || !startTime) {
        res.status(400).json({
          success: false,
          message: "Token, start, end coordinates and start time are required",
        });
        return;
      }

      // Validate coordinates format
      const startCoords = start.split(",").map(Number);
      const endCoords = end.split(",").map(Number);
      if (
        startCoords.length !== 2 ||
        endCoords.length !== 2 ||
        isNaN(startCoords[0]) ||
        isNaN(startCoords[1]) ||
        isNaN(endCoords[0]) ||
        isNaN(endCoords[1])
      ) {
        res.status(400).json({
          success: false,
          message: "Start and end must be valid lat,lon coordinates",
        });
        return;
      }

      //fetch names from coordinates
      const startPlaceName = await getAddressFromCoordinates(startCoords);
      const endPlaceName = await getAddressFromCoordinates(endCoords);
      const distance = await getDistanceBetweenPoints(start, end);
      if (distance === null) {
        res.status(400).json({
          success: false,
          message: "Failed to calculate distance between points",
        });
        return;
      }

      if (!startPlaceName || !endPlaceName) {
        res.status(400).json({
          success: false,
          message: "Failed to fetch place names from coordinates",
        });
        return;
      }
      // Get user ID from token
      const userId = await getUserIdFromToken(token);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid token",
        });
        return;
      }

      // Parse start time
      const parsedStartTime = new Date(startTime);
      if (isNaN(parsedStartTime.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid start time format",
        });
        return;
      }

      // Create new route record
      const newRoute = await prisma.route.create({
        data: {
          creatorId: userId,
          startPlaceName,
          endPlaceName,
          startLat: startCoords[0],
          startLon: startCoords[1],
          endLat: endCoords[0],
          endLon: endCoords[1],
          distance,
        },
      });

      // Create new ride with this route as the primary route
      const newRide = await prisma.ride.create({
        data: {
          ownerId: userId,
          primaryRouteId: newRoute.id,
          start: parsedStartTime,
          totalCost:
            typeof totalCost === "number"
              ? totalCost
              : parseFloat(totalCost) || 0,
        },
        include: {
          primaryRoute: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        ride: newRide,
        message: "Ride created successfully",
      });
      return;
    } catch (error) {
      console.error("Error in createRide:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to create ride",
      });
      return;
    }
  }

  /**
   * Get ride details by ride ID
   */
  static async getRideDetails(req: Request, res: Response) {
    try {
      const { rideId } = req.params;

      if (!rideId) {
        res.status(400).json({
          success: false,
          message: "Ride ID is required",
        });
        return;
      }

      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          primaryRoute: {
            select: {
              startPlaceName: true,
              endPlaceName: true,
            },
          },
          members: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!ride) {
        res.status(404).json({
          success: false,
          message: "Ride not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        ride,
      });
    } catch (error) {
      console.error("Error in getRideDetails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch ride details",
        error: (error as Error).message,
      });
    }
  }
}

export default RouteController;
