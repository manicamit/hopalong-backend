import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserIdFromToken } from "../utils/getId";

const prisma = new PrismaClient();

export class RideInfoController {
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
              distance: true,
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

  /**
   * Get previous rides for the authenticated user
   */
  static async getPreviousRides(req: Request, res: Response) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          message: "Authentication token is required",
        });
        return;
      }

      const token = authHeader.split(" ")[1];

      // Get user ID from token
      const userId = await getUserIdFromToken(token);
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Invalid authentication token",
        });
        return;
      }

      // Get all rides where the user is an owner or member
      const rides = await prisma.ride.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
        },
        include: {
          primaryRoute: {
            select: {
              startPlaceName: true,
              endPlaceName: true,
              startLat: true,
              startLon: true,
              endLat: true,
              endLon: true,
              distance: true,
            },
          },
          members: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json({
        success: true,
        rides,
      });
    } catch (error) {
      console.error("Error in getPreviousRides:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch previous rides",
        error: (error as Error).message,
      });
    }
  }
}

export default RideInfoController;
