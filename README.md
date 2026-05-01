# Introduction

Hi! I'm Xinyu, year 3 CE student at NTU, currently interning as a SWE intern at a local startup and this is my version of a URL Shortener.

To summarise, the scope of this project covers the key features that one would expect in a URL shortener. I have left out things like deleting a URL / support expiry, so links are immutable.

Just to be upfront, I used Claude Code to write quite abit of the code, especially the frontend, written using the /frontend-design skill and the extensive tests. However, I made sure that I reviewed the code and ensured clean code and readability as much as possible (see more in [Architecture](#architecture) where I talk about using a MVC architecture for my backend)

Hope you like my project!

## Contents

- [Pre-requisites](#pre-requisites)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Functional Requirements](#functional-requirements)
- [API](#api)
- [Design Decisions](#design-decisions)
- [Architecture](#architecture)
- [Monitoring](#infra--monitoring)
- [Database](#database)
- [Tests](#tests)

## Pre-requisites

- [Bun](https://bun.sh) (runtime + package manager)
- [Docker](https://www.docker.com/) + Docker Compose (Postgres, Redis, Prometheus, Grafana)
- [k6](https://k6.io/) (optional — only needed for load tests)
- [DBeaver](https://dbeaver.io/) (optional — GUI for inspecting the Postgres database)

## Quick Start

```bash
# 1. Install deps from repo root (Bun workspace — installs root + client + server)
bun install

# 2. Copy the example env file (only DATABASE_URL is required; the rest have sensible defaults)
cp server/.env.example server/.env

# 3. Start infra from repo root (Postgres, Redis, Prometheus, Grafana)
bun docker:up

# 4. Apply DB migrations
cd server && bun prisma migrate dev && cd ..

# 5. Start client + server in watch mode from repo root
bun dev
```

- Client: http://localhost:5173
- Server: http://localhost:3000
- Grafana: http://localhost:3001
  - username: admin
  - password: admin

## Tech Stack

**Frontend** ([client/](client/))

- React 19 + Vite 8
- Tailwind CSS 4 + shadcn/ui
- TypeScript

**Backend** ([server/](server/))

- Bun runtime + Express 5
- TypeScript
- Prisma 6 (Postgres)
- ioredis (Redis client)
- Zod (request validation)
- nanoid + `crypto.randomBytes` (short code generation)
- prom-client (Prometheus metrics)

**Tooling**

- Biome (root-level lint/format)
- ESLint (client-only React rules)
- `bun test` for unit tests
- k6 for load/stress tests

## Functional Requirements

- Shorten a long URL into a short code
- Visit `GET /:shortCode` and get a 302 redirect to the original URL
- Optionally provide a custom alias when creating a short URL

## API

### `POST /shorten`

**Request body**

```ts
{
  originalUrl: string,
  customAlias?: string
}
```

**Response — 201**

```ts
{
  shortCode: string;
}
```

**Errors**

- `400` — invalid body (Zod issues returned)
- `409` — alias already taken
- `500` — could not allocate a unique short code after retries

### `GET /:shortCode`

`302` redirect to the stored `originalUrl`. If the code is invalid or unknown, redirects to the client with `?notFound=<code>`.

## Architecture

```
                ┌────────────┐
                │   Client   │
                └─────┬──────┘
                      │ POST /shorten
                      │ GET  /:shortCode
                      ▼
                ┌────────────┐
                │   Server   │
                └─┬────────┬─┘
       cache hit  │        │  cache miss
                  ▼        ▼
              ┌───────┐  ┌──────────┐
              │ Redis │  │ Postgres │
              └───────┘  └──────────┘
```

**Write path** (`POST /shorten`)

1. **User** pastes a long URL (and optionally a custom alias) into the form on the client and submits.
2. Controller parses the body with Zod. Invalid input → `400` with the Zod issues → client surfaces the message inline as a red error banner above the form.
3. Service generates an 8-char Base62 code (or uses the provided alias) and inserts into Postgres.
4. On a Postgres unique-violation, which means there's a shortCode collision:
   - **Generated code** — retry up to 3 times. If still colliding, controller returns `500` ("could not allocate a unique short code") → client shows the message and the user can retry.
   - **Custom alias** — service throws `AliasTakenError`, controller maps it to `409` → client tells the user the alias is taken so they can pick another.
5. Cache is _not_ warmed on write — the first reader populates Redis (lazy populate).
6. On success → `201 { shortCode }` → client swaps the form for a success card showing the short URL with a copy button.
7. Any other thrown error → `500` → client shows a generic error banner.

**Read path** (`GET /:shortCode`)

1. **User** clicks or pastes a short link (e.g. `http://localhost:3000/abc123`) into the browser.
2. Controller validates the param with Zod. Invalid format → `302` redirect to the client with `?notFound=<code>` → the home page reads the query param and shows a `Short URL '<code>' was not found` banner so the user can try again.
3. Service checks Redis first:
   - **Hit** — return the cached `originalUrl` immediately.
   - **Negative hit** — short-circuit to "not found" without touching Postgres.
   - **Miss** — query Postgres, then populate Redis (positive entry 7d TTL, negative sentinel 60s TTL).
4. If Postgres has no row → controller redirects to the client with `?notFound=<code>` (same UX as step 2). Otherwise → `302` to the stored `originalUrl` and the user lands on the original site.
5. Redis errors are swallowed (`.catch()`-guarded) — a Redis outage degrades to a Postgres-only path, so the user just sees a slightly slower redirect.
6. Any unhandled error → `500` → browser shows its default error page.

## Design Decisions

### MVC-style layering

The server is small but layered so that the code is cleaner, more maintainable and readable. This architectures enforces a separation of concerns clearly. Each function is exported and called using the namespace resembling their filename, eg. shortCodeHelper.generateShortCode(), urlService.createUrl()

- [server/src/url.controller.ts](server/src/url.controller.ts) — HTTP concerns (request parsing, status codes, error → response mapping) as well as orchestrating the validators and services.
- [server/src/url.validator.ts](server/src/url.validator.ts) — Uses Zod to validate req body and ensure data is always in correct shape when hitting the services. Zod also makes declaring the schema very simple and readable.
- [server/src/url.service.ts](server/src/url.service.ts) — database operations
- [server/src/shortcode.helper.ts](server/src/shortcode.helper.ts) — purely shortCode generation, easy to unit-test.

### Short code generation

- 8-char Base62 string built from `crypto.randomBytes` (62^8 ≈ 2.18 × 10^14 codes — collision probability is negligible at our scale).
- Initially I had used Math.random() but apparently it was less secure because the underlying algorithm makes shortCodes generation predictable. Since using `crypto.randomBytes` is just a simple few lines change, I went ahead with it.
- On insert collision, retry up to 3 times before returning a 500. Given that our keyspace size is huge, retrying each additional time is a drastic decrease in collision probability.
- Users are allowed to input custom aliases as they prefer. This bypasses generation.

### Cache-aside (Redis)

Implemented in [server/src/url.service.ts](server/src/url.service.ts) `getOriginalUrl`. I'm assuming it is more often that short links are clicked rather than created, which means the read path will have more traffic than the write path. Hence I added caching for the read path using Redis.

- **Immutability contract** — short codes are never edited or deleted, so the cache needs zero invalidation logic.
- **Positive entries** — Entries have a 7d TTL, so that memory doesn't go out-of-bounds.
- **Negative cache** — We also cache invalid URLs with 60s TTL, so a flood of requests for a not-yet-created alias does not hammer Postgres.
- **Lazy populate** — writes do not warm the cache; first reader fills it.
- **A/B switch** — `CACHE_ENABLED=false` disables the cache so we can compare metrics against a baseline.

## Monitoring

To measure the latency of the read path with and without Redis, I setup a simple monitoring infra using Prometheus for scraping metrics and grafana for the dashboard.

1. Open the grafana dashboard http://localhost:3001
2. Log in with these credentials defined in docker-compose.yml:

- Username: admin
- Password: admin

3. Click the dashboard tab. A dashboard called _URL Shortener — Read Path_ is already configured from [infra/grafana/dashboards/](infra/grafana/dashboards/). It plots:

- `redirect_latency_ms`
- `cache_lookups_total`
- `db_queries_total`

## Database

I decided to use a relationship database PostgreSQL since short links redirects are essentially taking a shortCode and finding its originalURL mapping. I have only one table called `URL`.

You can also access the database by setting up a connection with a database GUI using the connection string defined in .env. I used DBeaver for the GUI.

The container exposes `5432` on the host, so DBeaver connect PostgreSQL at `localhost:5432`.

## Tests

**Unit tests**

```bash
cd server && bun test
```

Files: `*.unit.test.ts` next to the code under test (`url.controller`, `url.service`, `url.validator`, `shortcode.helper`).

**Load tests (k6)**
Run each twice — once with the cache off to capture a baseline, then with it on:

```bash
# Gentle: 50 VUs + 5 creates/sec for 60s
CACHE_ENABLED=false bun --cwd server dev   # then in another shell:
k6 run scripts/load-test.js
```

Then restart the server with `CACHE_ENABLED=true` and rerun to A/B the results against the Grafana dashboard.
