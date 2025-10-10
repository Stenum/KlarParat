import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasources: databaseUrl
    ? {
        db: {
          url: databaseUrl,
        },
      }
    : undefined,
});
