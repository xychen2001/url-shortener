import { Prisma } from '@prisma/client'
import { prisma } from './db'
import * as shortCodeHelper from './shortcode.helper'

const MAX_SHORTCODE_ATTEMPTS = 3

export class AliasTakenError extends Error {
  constructor(alias: string) {
    super(`Alias '${alias}' is already taken`)
    this.name = 'AliasTakenError'
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function getOriginalUrl(shortCode: string) {
  return prisma.url.findUnique({
    where: { shortCode },
  })
}

export async function createShortUrl(originalUrl: string, customAlias?: string) {
  if (customAlias !== undefined) {
    return createWithAlias(originalUrl, customAlias)
  }
  return createWithGeneratedCode(originalUrl)
}

async function createWithAlias(originalUrl: string, alias: string) {
  try {
    return await prisma.url.create({
      data: { shortCode: alias, originalUrl },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AliasTakenError(alias)
    }
    throw error
  }
}

async function createWithGeneratedCode(originalUrl: string) {
  for (let attempt = 0; attempt < MAX_SHORTCODE_ATTEMPTS; attempt++) {
    const shortCode = shortCodeHelper.generateShortCode()

    try {
      const entry = await prisma.url.create({
        data: { shortCode, originalUrl },
      })
      return entry
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue
      }
      throw error
    }
  }

  return null
}
