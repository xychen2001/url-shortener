import client from 'prom-client'

export const redirectLatency = new client.Histogram({
  name: 'redirect_latency_ms',
  help: 'Redirect handler latency in milliseconds',
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500],
})

export const cacheLookups = new client.Counter({
  name: 'cache_lookups_total',
  help: 'Cache lookups by outcome',
  labelNames: ['outcome'] as const,
})

export const dbQueries = new client.Counter({
  name: 'db_queries_total',
  help: 'Postgres queries by op',
  labelNames: ['op'] as const,
})

export const register = client.register
