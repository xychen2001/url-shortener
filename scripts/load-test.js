// k6 load test for the redirect path.
//
// Usage:
//   k6 run scripts/load-test.js
//   k6 run -e BASE_URL=http://localhost:3000 -e SEED_COUNT=100 -e VUS=50 scripts/load-test.js
//
// Ran twice to compare baseline vs cache: once before Redis ships, once after.
// Inspect Grafana http://localhost:3001 — same dashboard, two runs side by side.

import { check } from 'k6'
import http from 'k6/http'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const SEED_COUNT = Number(__ENV.SEED_COUNT || 100)
const VUS = Number(__ENV.VUS || 50)
const DURATION = __ENV.DURATION || '60s'
const CREATE_RATE = Number(__ENV.CREATE_RATE || 5) // creates per second during the run

export const options = {
  scenarios: {
    redirects: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      startTime: '5s', // give setup() time to seed before VUs ramp
    },
    creates: {
      executor: 'constant-arrival-rate',
      rate: CREATE_RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.max(2, Math.ceil(CREATE_RATE)),
      startTime: '5s',
      exec: 'createShort',
    },
  },
}

export function setup() {
  const codes = []
  for (let i = 0; i < SEED_COUNT; i++) {
    const res = http.post(
      `${BASE_URL}/shorten`,
      JSON.stringify({
        originalUrl: `https://example.com/seed/${i}/${Date.now()}`,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    if (res.status === 201) {
      const body = JSON.parse(res.body)
      codes.push(body.shortCode)
    }
  }
  if (codes.length === 0) {
    throw new Error('Failed to seed any short codes — is the server running?')
  }
  console.log(`seeded ${codes.length}/${SEED_COUNT} short codes`)
  return { codes }
}

export default function (data) {
  const code = data.codes[Math.floor(Math.random() * data.codes.length)]
  // redirects:0 means k6 sees the 302 instead of following it to the frontend.
  const res = http.get(`${BASE_URL}/${code}`, { redirects: 0 })
  check(res, { 'is 302': (r) => r.status === 302 })
}

export function createShort() {
  const res = http.post(
    `${BASE_URL}/shorten`,
    JSON.stringify({
      originalUrl: `https://example.com/load/${__VU}/${__ITER}/${Date.now()}`,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  check(res, { 'is 201': (r) => r.status === 201 })
}
