import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Prisma } from '@prisma/client'
import * as dbModule from './db'
import * as redisModule from './redis'
import * as shortCodeHelperModule from './shortcode.helper'

const realDbExports = { ...dbModule }
const realRedisExports = { ...redisModule }
const realHelperExports = { ...shortCodeHelperModule }

const findUnique = mock()
const create = mock()
const generateShortCode = mock()
const redisGet = mock()
const redisSetex = mock()

mock.module('./db', () => ({
  prisma: { url: { findUnique, create } },
}))
mock.module('./redis', () => ({
  redis: { get: redisGet, setex: redisSetex },
}))
mock.module('./shortcode.helper', () => ({ generateShortCode }))

const { getOriginalUrl, createShortUrl, AliasTakenError } = await import('./url.service')

function makeCollisionError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

beforeEach(() => {
  findUnique.mockReset()
  create.mockReset()
  generateShortCode.mockReset()
  redisGet.mockReset()
  redisSetex.mockReset()
  // Default: cache miss + setex no-op success.
  redisGet.mockResolvedValue(null)
  redisSetex.mockResolvedValue('OK')
})

afterAll(() => {
  mock.module('./db', () => realDbExports)
  mock.module('./redis', () => realRedisExports)
  mock.module('./shortcode.helper', () => realHelperExports)
})

describe('getOriginalUrl', () => {
  it('returns from Postgres on a cache miss and populates the cache', async () => {
    const row = { shortCode: 'abcd1234', originalUrl: 'https://example.com' }
    redisGet.mockResolvedValueOnce(null)
    findUnique.mockResolvedValueOnce(row)

    const result = await getOriginalUrl('abcd1234')

    expect(redisGet).toHaveBeenCalledWith('url:abcd1234')
    expect(findUnique).toHaveBeenCalledWith({
      where: { shortCode: 'abcd1234' },
      select: { shortCode: true, originalUrl: true },
    })
    expect(redisSetex).toHaveBeenCalledWith(
      'url:abcd1234',
      expect.any(Number),
      'https://example.com',
    )
    expect(result).toEqual(row)
  })

  it('returns from cache on a hit and skips Postgres', async () => {
    redisGet.mockResolvedValueOnce('https://example.com')

    const result = await getOriginalUrl('abcd1234')

    expect(result).toEqual({ shortCode: 'abcd1234', originalUrl: 'https://example.com' })
    expect(findUnique).not.toHaveBeenCalled()
    expect(redisSetex).not.toHaveBeenCalled()
  })

  it('returns null on a negative-cache hit and skips Postgres', async () => {
    redisGet.mockResolvedValueOnce('__NX__')

    const result = await getOriginalUrl('abcd1234')

    expect(result).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('caches a negative result when Postgres returns null', async () => {
    redisGet.mockResolvedValueOnce(null)
    findUnique.mockResolvedValueOnce(null)

    const result = await getOriginalUrl('abcd1234')

    expect(result).toBeNull()
    expect(redisSetex).toHaveBeenCalledWith('url:abcd1234', expect.any(Number), '__NX__')
  })

  it('falls through to Postgres when Redis is unavailable', async () => {
    const row = { shortCode: 'abcd1234', originalUrl: 'https://example.com' }
    redisGet.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    redisSetex.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    findUnique.mockResolvedValueOnce(row)

    const result = await getOriginalUrl('abcd1234')

    expect(result).toEqual(row)
    expect(findUnique).toHaveBeenCalledTimes(1)
  })
})

describe('createShortUrl', () => {
  it('returns the entry on the first successful create', async () => {
    const entry = {
      id: 1,
      shortCode: 'code0001',
      originalUrl: 'https://example.com',
      createdAt: new Date(),
    }
    generateShortCode.mockReturnValueOnce('code0001')
    create.mockResolvedValueOnce(entry)

    const result = await createShortUrl('https://example.com')

    expect(result).toEqual(entry)
    expect(generateShortCode).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: { shortCode: 'code0001', originalUrl: 'https://example.com' },
    })
  })

  it('retries on a P2002 collision and succeeds on the next attempt', async () => {
    const entry = {
      id: 2,
      shortCode: 'code0002',
      originalUrl: 'https://example.com',
      createdAt: new Date(),
    }
    generateShortCode.mockReturnValueOnce('code0001').mockReturnValueOnce('code0002')
    create.mockRejectedValueOnce(makeCollisionError()).mockResolvedValueOnce(entry)

    const result = await createShortUrl('https://example.com')

    expect(result).toEqual(entry)
    expect(generateShortCode).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('returns null after MAX_SHORTCODE_ATTEMPTS consecutive collisions', async () => {
    generateShortCode
      .mockReturnValueOnce('code0001')
      .mockReturnValueOnce('code0002')
      .mockReturnValueOnce('code0003')
    create
      .mockRejectedValueOnce(makeCollisionError())
      .mockRejectedValueOnce(makeCollisionError())
      .mockRejectedValueOnce(makeCollisionError())

    const result = await createShortUrl('https://example.com')

    expect(result).toBeNull()
    expect(generateShortCode).toHaveBeenCalledTimes(3)
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('rethrows non-collision errors', async () => {
    generateShortCode.mockReturnValueOnce('code0001')
    create.mockRejectedValueOnce(new Error('connection refused'))

    expect(createShortUrl('https://example.com')).rejects.toThrow('connection refused')
  })

  it('inserts with the supplied customAlias and skips the generator', async () => {
    const entry = {
      id: 3,
      shortCode: 'myLink',
      originalUrl: 'https://example.com',
      createdAt: new Date(),
    }
    create.mockResolvedValueOnce(entry)

    const result = await createShortUrl('https://example.com', 'myLink')

    expect(result).toEqual(entry)
    expect(generateShortCode).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: { shortCode: 'myLink', originalUrl: 'https://example.com' },
    })
  })

  it('throws AliasTakenError on a P2002 collision when a customAlias is supplied (no retry)', async () => {
    create.mockRejectedValueOnce(makeCollisionError())

    expect(createShortUrl('https://example.com', 'myLink')).rejects.toBeInstanceOf(AliasTakenError)
    expect(generateShortCode).not.toHaveBeenCalled()
  })

  it('rethrows non-collision errors when a customAlias is supplied', async () => {
    create.mockRejectedValueOnce(new Error('connection refused'))

    expect(createShortUrl('https://example.com', 'myLink')).rejects.toThrow('connection refused')
  })
})
