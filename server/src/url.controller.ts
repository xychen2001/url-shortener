import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { redirectLatency } from './metrics'
import * as urlService from './url.service'
import { AliasTakenError } from './url.service'
import * as urlValidator from './url.validator'

// TODO: move to .env (matches the CORS origin in index.ts)
const FRONTEND_BASE = 'http://localhost:5173'

function notFoundRedirect(res: Response, attemptedCode: string) {
  const url = `${FRONTEND_BASE}/?notFound=${encodeURIComponent(attemptedCode)}`
  return res.redirect(302, url)
}

export async function handleRedirect(req: Request<{ shortCode: string }>, res: Response) {
  const endTimer = redirectLatency.startTimer()
  try {
    const { shortCode } = urlValidator.parseRedirectParams(req.params)
    const url = await urlService.getOriginalUrl(shortCode)

    if (!url) {
      return notFoundRedirect(res, shortCode)
    }

    return res.redirect(302, url.originalUrl)
  } catch (error) {
    if (error instanceof ZodError) {
      return notFoundRedirect(res, req.params.shortCode)
    }
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    endTimer()
  }
}

export async function handleShorten(req: Request, res: Response) {
  try {
    const { originalUrl, customAlias } = urlValidator.parseShortenBody(req.body)
    const entry = await urlService.createShortUrl(originalUrl, customAlias)
    if (!entry) {
      return res.status(500).json({
        error: 'Could not allocate a unique short code, please retry',
      })
    }
    return res.status(201).json({ shortCode: entry.shortCode })
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        issues: error.issues,
      })
    }
    if (error instanceof AliasTakenError) {
      return res.status(409).json({ error: 'Alias already taken' })
    }
    return res.status(500).json({ error: 'Failed to create short URL' })
  }
}
