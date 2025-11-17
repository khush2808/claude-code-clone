import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Initialize Prisma client only if DATABASE_URL is available
 * Returns null if database is not configured
 */
export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!prisma) {
    try {
      prisma = new PrismaClient({
        // log: ['error'],
      });
    } catch (error) {
      // If Prisma fails to initialize, return null
      return null;
    }
  }

  return prisma;
}

/**
 * Check if database is available and connected
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  const client = getPrismaClient();
  if (!client) {
    return false;
  }

  try {
    // Try a simple query to check connection
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

// Export prisma for backward compatibility (will be null if not available)
export { prisma };
