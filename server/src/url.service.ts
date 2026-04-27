import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import * as shortCodeHelper from "./shortcode.helper";

const MAX_SHORTCODE_ATTEMPTS = 3;

export async function getOriginalUrl(shortCode: string) {
  return prisma.url.findUnique({
    where: { shortCode },
  });
}

export async function createShortUrl(originalUrl: string) {
  // for loop handles shortCode collision
  for (let attempt = 0; attempt < MAX_SHORTCODE_ATTEMPTS; attempt++) {
    const shortCode = shortCodeHelper.generateShortCode();

    try {
      // TODO: make originalUrl field by using upsert
      const entry = await prisma.url.create({
        data: {
          shortCode,
          originalUrl,
        },
      });
      return entry;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return null;
}
