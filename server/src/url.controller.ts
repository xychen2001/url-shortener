import type { Request, Response } from "express";
import { ZodError } from "zod";
import * as urlService from "./url.service";
import * as urlValidator from "./url.validator";

export async function handleRedirect(
  req: Request<{ shortCode: string }>,
  res: Response,
) {
  try {
    const { shortCode } = urlValidator.parseRedirectParams(req.params);
    const url = await urlService.getOriginalUrl(shortCode);

    if (!url) {
      return res.status(404).json({ error: "No matching url found" });
    }

    return res.redirect(302, url.originalUrl);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid short code",
        issues: error.issues,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleShorten(req: Request, res: Response) {
  try {
    const { originalUrl } = urlValidator.parseShortenBody(req.body);
    const entry = await urlService.createShortUrl(originalUrl);
    if (!entry) {
      return res.status(500).json({
        error: "Could not allocate a unique short code, please retry",
      });
    }
    return res.status(201).json({ shortCode: entry.shortCode });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request body",
        issues: error.issues,
      });
    }
    return res.status(500).json({ error: "Failed to create short URL" });
  }
}
