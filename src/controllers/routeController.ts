import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { checkRouteOverlap, getRoutes } from "../utils/routeMatch";
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
          message:
            "Token, start, end coordinates, and place names are required",
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
      const startPlaceName = await getPlaceName(startCoords[0], startCoords[1]);
      const endPlaceName = await getPlaceName(endCoords[0], endCoords[1]);
      if (!startPlaceName || !endPlaceName) {
        res.status(400).json({
          success: false,
          message: "Failed to fetch place names from coordinates",
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

      // Parse requested start time if provided
      const requestedStartTime = startTime ? new Date(startTime) : new Date();

      // Calculate time window for matching (±12 hours)
      const startTimeMin = new Date(requestedStartTime);
      startTimeMin.setHours(startTimeMin.getHours() - 12);
      const startTimeMax = new Date(requestedStartTime);
      startTimeMax.setHours(startTimeMax.getHours() + 12);

      // Fetch all existing routes from the database along with their rides
      const existingRoutes = await prisma.route.findMany({
        include: {
          creator: { select: { firstName: true, lastName: true } },
          primaryForRide: true,
          memberOfRide: true,
        },
      });

      if (existingRoutes.length === 0) {
        res.status(200).json({
          success: true,
          matches: [],
          message: "No routes found for matching",
        });
        return;
      }

      // Check each route for overlap with the new route
      const matchResults = [];
      for (const existingRoute of existingRoutes) {
        // Skip user's own routes
        if (existingRoute.creatorId === userId) {
          continue;
        }

        // Get ride information for time filtering
        const ride = existingRoute.primaryForRide || existingRoute.memberOfRide;

        // Skip routes without a ride or with a ride outside the time window
        if (!ride || ride.start < startTimeMin || ride.start > startTimeMax) {
          continue;
        }

        // Construct route start/end strings for comparison
        const routeStart = `${existingRoute.startLat},${existingRoute.startLon}`;
        const routeEnd = `${existingRoute.endLat},${existingRoute.endLon}`;

        const result = await checkRouteOverlap(
          start,
          end,
          routeStart,
          routeEnd
        );

        if (result.overlap && result.overlapPercentage > 0) {
          matchResults.push({
            route: existingRoute,
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
        message: `Found ${matchResults.length} matching routes within 12 hour time window`,
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
   * Merge two routes, ensuring the caller owns at least one of them and they have compatible time windows
   */
  static async mergeRoute(req: Request, res: Response) {
    try {
      const { token, routeId1, routeId2 } = req.body;

      if (!token || !routeId1 || !routeId2) {
        res.status(400).json({
          success: false,
          message: "Token and two route IDs are required",
        });
        return;
      }

      if (routeId1 === routeId2) {
        res.status(400).json({
          success: false,
          message: "Cannot merge a route with itself",
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

      // Fetch both routes with their associated rides
      const route1 = await prisma.route.findUnique({
        where: { id: routeId1 },
        include: { primaryForRide: true, memberOfRide: true },
      });

      const route2 = await prisma.route.findUnique({
        where: { id: routeId2 },
        include: { primaryForRide: true, memberOfRide: true },
      });

      if (!route1 || !route2) {
        res.status(404).json({
          success: false,
          message: "One or both routes not found",
        });
        return;
      }

      // Check ownership - user must own at least one of the routes
      if (route1.creatorId !== userId && route2.creatorId !== userId) {
        res.status(403).json({
          success: false,
          message:
            "You must be the owner of at least one of the routes to merge them",
        });
        return;
      }

      // Get associated rides
      const ride1 = route1.primaryForRide || route1.memberOfRide;
      const ride2 = route2.primaryForRide || route2.memberOfRide;

      // Check if both routes have rides
      if (ride1 && ride2) {
        // Check time compatibility (within 12 hours)
        const timeDiff = Math.abs(
          ride1.start.getTime() - ride2.start.getTime()
        );
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff > 12) {
          res.status(400).json({
            success: false,
            message:
              "Routes cannot be merged as their ride times differ by more than 12 hours",
            hoursDifference: hoursDiff,
          });
          return;
        }
      }

      // Determine which route to keep and which to delete
      // Keep the route owned by current user if possible, or the primary route if exists
      const keepRoute1 =
        route1.creatorId === userId ||
        (route1.primaryForRide && !route2.primaryForRide);

      const targetRoute = keepRoute1 ? route1 : route2;
      const sourceRoute = keepRoute1 ? route2 : route1;

      // If source is a primary route and target isn't, we need special handling
      if (sourceRoute.primaryForRide && !targetRoute.primaryForRide) {
        // Update the ride to use targetRoute as primary
        if (sourceRoute.primaryForRide) {
          await prisma.ride.update({
            where: { id: sourceRoute.primaryForRide.id },
            data: { primaryRouteId: targetRoute.id },
          });
        }
      }

      // If source is a member of a ride, remove that association
      if (sourceRoute.memberOfRide) {
        await prisma.route.update({
          where: { id: sourceRoute.id },
          data: { memberRideId: null },
        });
      }

      // Update the target route with merged data if needed
      const updatedRoute = await prisma.route.update({
        where: { id: targetRoute.id },
        data: {
          // Only update these fields if target is not already a primary route
          ...(targetRoute.primaryForRide
            ? {}
            : {
                distance: Math.max(
                  targetRoute.distance || 0,
                  sourceRoute.distance || 0
                ),
              }),
        },
      });

      // Delete the source route that is now merged
      await prisma.route.delete({
        where: { id: sourceRoute.id },
      });

      res.status(200).json({
        success: true,
        mergedRouteId: targetRoute.id,
        mergedRoute: updatedRoute,
        message: "Routes merged successfully",
      });
      return;
    } catch (error) {
      console.error("Error in mergeRoute:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to merge routes",
      });
      return;
    }
  }

  /**
   * Create a new route in the database
   */
  static async createRoute(req: Request, res: Response) {
    try {
      const { token, start, end, startPlaceName, endPlaceName, distance } =
        req.body;

      if (!token || !start || !end || !startPlaceName || !endPlaceName) {
        res.status(400).json({
          success: false,
          message: "Token, start/end coordinates and place names are required",
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

      // Get user ID from token
      const userId = await getUserIdFromToken(token);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid token",
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
          distance: distance || 0,
        },
      });

      res.status(201).json({
        success: true,
        route: newRoute,
        message: "Route created successfully",
      });
      return;
    } catch (error) {
      console.error("Error in createRoute:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to create route",
      });
      return;
    }
  }
}

export default RouteController;
