import { z } from "zod";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_URL_LENGTH = 2048;
// Matches shortcode.helper.ts: 8 chars from base62 [0-9A-Za-z]
const SHORTCODE_PATTERN = /^[0-9A-Za-z]{8}$/;

const shortenBodySchema = z.object({
  originalUrl: z
    .string()
    .min(1, "originalUrl is required")
    .max(
      MAX_URL_LENGTH,
      `originalUrl must be at most ${MAX_URL_LENGTH} characters`,
    )
    .refine((value) => {
      try {
        const url = new URL(value);
        return HTTP_PROTOCOLS.has(url.protocol);
      } catch {
        return false;
      }
    }, "originalUrl must be a valid http(s) URL"),
});

export type TShortenBody = z.infer<typeof shortenBodySchema>;

export function parseShortenBody(body: unknown): TShortenBody {
  return shortenBodySchema.parse(body);
}

const redirectParamsSchema = z.object({
  shortCode: z
    .string()
    .regex(SHORTCODE_PATTERN, "shortCode must be 8 alphanumeric characters"),
});

export type TRedirectParams = z.infer<typeof redirectParamsSchema>;

export function parseRedirectParams(params: unknown): TRedirectParams {
  return redirectParamsSchema.parse(params);
}
