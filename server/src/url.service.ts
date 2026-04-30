import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { cacheLookups, dbQueries } from './metrics'
import { redis } from './redis'
import * as shortCodeHelper from './shortcode.helper'

const MAX_SHORTCODE_ATTEMPTS = 3
const POSITIVE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
const NEGATIVE_TTL_SECONDS = 60 // 1 minute
const NEG_SENTINEL = '__NX__'

type TUrlLookup = { shortCode: string; originalUrl: string }

export class AliasTakenError extends Error {
  constructor(alias: string) {
    super(`Alias '${alias}' is already taken`)
    this.name = 'AliasTakenError'
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function getOriginalUrl(shortCode: string): Promise<TUrlLookup | null> {
  const cacheOn = process.env.CACHE_ENABLED !== 'false'
  const cacheKey = `url:${shortCode}`

  if (cacheOn) {
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached === NEG_SENTINEL) {
      cacheLookups.inc({ outcome: 'negative' })
      return null
    }
    if (cached) {
      cacheLookups.inc({ outcome: 'hit' })
      return { shortCode, originalUrl: cached }
    }
    cacheLookups.inc({ outcome: 'miss' })
  }

  dbQueries.inc({ op: 'find' })
  const row = await prisma.url.findUnique({
    where: { shortCode },
    select: { shortCode: true, originalUrl: true },
  })

  if (cacheOn) {
    const value = row ? row.originalUrl : NEG_SENTINEL
    const ttl = row ? POSITIVE_TTL_SECONDS : NEGATIVE_TTL_SECONDS
    await redis.setex(cacheKey, ttl, value).catch(() => {})
  }

  return row
}

export async function createShortUrl(originalUrl: string, customAlias?: string) {
  if (customAlias !== undefined) {
    return createWithAlias(originalUrl, customAlias)
  }
  return createWithGeneratedCode(originalUrl)
}

async function createWithAlias(originalUrl: string, alias: string) {
  try {
    dbQueries.inc({ op: 'create' })
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
      dbQueries.inc({ op: 'create' })
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
