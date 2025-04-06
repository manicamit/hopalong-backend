import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Gets a user ID from a session token
 * @param token The session token to look up
 * @returns The user ID if found, null otherwise
 */
export async function getUserIdFromToken(
  token: string
): Promise<string | null> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        session_token: token,
      },
      select: {
        id: true,
      },
    });

    return user ? user.id : null;
  } catch (error) {
    console.error("Error getting user ID from token:", error);
    return null;
  }
}

/**
 * Gets proper name fields for a user based on their privacy level
 * @param userId The user ID to get name fields for
 * @returns An object with firstName and lastName, respecting privacy levels
 */
export async function getUserNameFields(
  userId: string
): Promise<{ firstName: string; lastName: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        firstName: true,
        lastName: true,
        privateFName: true,
        privateLName: true,
        privacyLevel: true,
      },
    });

    if (!user) {
      return { firstName: "Unknown", lastName: "User" };
    }

    // If privacy level is non-zero, return private names
    if (user.privacyLevel > 0) {
      return {
        firstName: user.privateFName,
        lastName: user.privateLName,
      };
    }

    // Otherwise return actual names
    return {
      firstName: user.firstName,
      lastName: user.lastName,
    };
  } catch (error) {
    console.error("Error getting user name fields:", error);
    return { firstName: "Unknown", lastName: "User" };
  }
}
