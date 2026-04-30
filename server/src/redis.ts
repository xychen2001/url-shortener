import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// lazyConnect: don't connect on import (so unit tests that touch the module
// don't trigger network IO). ioredis auto-connects on the first command.
// enableOfflineQueue: false: don't buffer commands while disconnected — fail
// fast so the cache-aside .catch() in url.service.ts falls through to Postgres
// rather than stalling the redirect path.
export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
})

redis.on('error', (err) => {
  console.error('[redis] error:', err.message)
})
