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
