import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getUserIdFromToken } from "../utils/getId";
import axios from "axios";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const centrifugoUrl = process.env.CENTRIFUGO_HTTP_URL || "";
const centrifugoApiKey = process.env.CENTRIFUGO_API_KEY || "";
const centrifugoTokenSecret = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET || "";

class ChatController {
  /**
   * Subscribe to a chat - generates a JWT token for Centrifugo
   */
  static async subscribeToChat(req: Request, res: Response) {
    try {
      const { token, rideId } = req.body;

      if (!token || !rideId) {
        res.status(400).json({
          success: false,
          message: "Token and rideId are required",
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

      // Check if user is a member or owner of the ride
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          members: {
            select: { id: true },
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

      const isOwner = ride.ownerId === userId;
      const isMember = ride.members.some((member) => member.id === userId);

      if (!isOwner && !isMember) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this chat",
        });
        return;
      }

      // Generate JWT token for Centrifugo
      const channel = `ride:${rideId}`;
      const centrifugoToken = jwt.sign(
        {
          sub: userId,
          channels: [channel],
          info: { username: userId },
        },
        centrifugoTokenSecret,
        { expiresIn: "24h" }
      );

      res.status(200).json({
        success: true,
        token: centrifugoToken,
        channel,
        message: "Successfully subscribed to chat",
      });
      return;
    } catch (error) {
      console.error("Error in subscribeToChat:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to subscribe to chat",
      });
      return;
    }
  }

  /**
   * Get previous messages for a specific ride
   */
  static async getPreviousMessages(req: Request, res: Response) {
    try {
      const { token, rideId, limit = 50, offset = 0 } = req.body;

      if (!token || !rideId) {
        res.status(400).json({
          success: false,
          message: "Token and rideId are required",
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

      // Check if user is a member or owner of the ride
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          members: {
            select: { id: true },
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

      const isOwner = ride.ownerId === userId;
      const isMember = ride.members.some((member) => member.id === userId);

      if (!isOwner && !isMember) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this chat",
        });
        return;
      }

      // Get messages for the ride
      const messages = await prisma.message.findMany({
        where: { rideId },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              privateFName: true,
              privateLName: true,
              privacyLevel: true,
              profilePic: true,
            },
          },
        },
        orderBy: { sentAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      });

      // Process messages to respect privacy settings
      const processedMessages = messages.map((msg) => {
        const { sender, ...rest } = msg;
        return {
          ...rest,
          sender: {
            id: sender.id,
            firstName: sender.privacyLevel > 0 ? sender.privateFName : sender.firstName,
            lastName: sender.privacyLevel > 0 ? sender.privateLName : sender.lastName,
            profilePic: sender.profilePic,
          },
        };
      });

      res.status(200).json({
        success: true,
        messages: processedMessages.reverse(), // Return in chronological order
        message: "Successfully retrieved messages",
      });
      return;
    } catch (error) {
      console.error("Error in getPreviousMessages:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to retrieve messages",
      });
      return;
    }
  }

  /**
   * Send a message to a ride's chat channel
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      const { token, rideId, content } = req.body;

      if (!token || !rideId || !content) {
        res.status(400).json({
          success: false,
          message: "Token, rideId and content are required",
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

      // Check if user is a member or owner of the ride
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          members: {
            select: { id: true },
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

      const isOwner = ride.ownerId === userId;
      const isMember = ride.members.some((member) => member.id === userId);

      if (!isOwner && !isMember) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this chat",
        });
        return;
      }

      // Create the message in the database
      const message = await prisma.message.create({
        data: {
          content,
          senderId: userId,
          rideId,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              privateFName: true,
              privateLName: true,
              privacyLevel: true,
              profilePic: true,
            },
          },
        },
      });

      // Apply privacy settings to message before sending to Centrifugo
      const processedMessage = {
        ...message,
        sender: {
          id: message.sender.id,
          firstName: message.sender.privacyLevel > 0 ? message.sender.privateFName : message.sender.firstName,
          lastName: message.sender.privacyLevel > 0 ? message.sender.privateLName : message.sender.lastName,
          profilePic: message.sender.profilePic,
        },
      };

      // Send the message to Centrifugo
      const channel = `ride:${rideId}`;
      await axios.post(
        centrifugoUrl,
        {
          method: "publish",
          params: {
            channel,
            data: processedMessage,
          },
        },
        {
          headers: {
            Authorization: `apikey ${centrifugoApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      res.status(200).json({
        success: true,
        message: "Message sent successfully",
        data: processedMessage,
      });
      return;
    } catch (error) {
      console.error("Error in sendMessage:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to send message",
      });
    }
  }

  /**
   * Get all rides (chats) a user is a member or owner of
   */
  static async getAllChats(req: Request, res: Response) {
    try {
      const token = req.query.token as string;

      if (!token) {
        res.status(400).json({
          success: false,
          message: "Token is required",
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

      // Get all rides where the user is an owner or member
      const rides = await prisma.ride.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
        },
        include: {
          primaryRoute: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              privateFName: true,
              privateLName: true,
              privacyLevel: true,
            },
          },
          members: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              privateFName: true,
              privateLName: true,
              privacyLevel: true,
            },
          },
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  privateFName: true,
                  privateLName: true,
                  privacyLevel: true,
                },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      // Process rides to respect privacy settings
      const processedRides = rides.map((ride) => {
        return {
          ...ride,
          owner: {
            id: ride.owner.id,
            firstName: ride.owner.privacyLevel > 0 ? ride.owner.privateFName : ride.owner.firstName,
            lastName: ride.owner.privacyLevel > 0 ? ride.owner.privateLName : ride.owner.lastName,
          },
          members: ride.members.map((member) => ({
            id: member.id,
            firstName: member.privacyLevel > 0 ? member.privateFName : member.firstName,
            lastName: member.privacyLevel > 0 ? member.privateLName : member.lastName,
          })),
          messages: ride.messages.map((msg) => ({
            ...msg,
            sender: {
              id: msg.sender.id,
              firstName: msg.sender.privacyLevel > 0 ? msg.sender.privateFName : msg.sender.firstName,
              lastName: msg.sender.privacyLevel > 0 ? msg.sender.privateLName : msg.sender.lastName,
            },
          })),
        };
      });

      res.status(200).json({
        success: true,
        chats: processedRides,
        message: "Successfully retrieved chats",
      });
      return;
    } catch (error) {
      console.error("Error in getAllChats:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
        message: "Failed to retrieve chats",
      });
    }
  }
}

export default ChatController;
