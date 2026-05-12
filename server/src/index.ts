import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { register as metricsRegister } from './metrics'
import * as urlController from './url.controller'

const app = express()
const PORT = process.env.PORT || 3000
const METRICS_PORT = process.env.METRICS_PORT || 9090

// TODO: change origin to use .env
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  return res.json({ status: 'ok' })
})

app.get('/:shortCode', urlController.handleRedirect)

app.post('/shorten', urlController.handleShorten)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

// Metrics on a separate port. Locally this is reachable on the host so Prometheus (in docker) can scrape via host.docker.internal:9090.
// In production this should be bound to a private interface / not exposed outside the container network.
const metricsApp = express()
metricsApp.get('/metrics', async (_req, res) => {
  res.set('Content-Type', metricsRegister.contentType)
  res.end(await metricsRegister.metrics())
})
metricsApp.listen(METRICS_PORT, () => {
  console.log(`Metrics on http://localhost:${METRICS_PORT}/metrics (private)`)
})
