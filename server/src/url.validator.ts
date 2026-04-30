import { z } from 'zod'

const HTTP_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_URL_LENGTH = 2048
// shortCode column holds two semantically different things
//   - Auto-generated codes (shortcode.helper.ts): always 8 chars.
//   - User-chosen aliases: 3-16 chars at user discretion. Short aliases are guessable; users who pick short aliases should be opting into a public URL
const SHORTCODE_PATTERN = /^[0-9A-Za-z]{3,16}$/
const RESERVED_ALIASES = new Set([
  'health',
  'shorten',
  'api',
  'admin',
  'login',
  'signup',
  'app',
  'static',
  'assets',
  'public',
])

const shortenBodySchema = z.object({
  originalUrl: z
    .string()
    .min(1, 'originalUrl is required')
    .max(MAX_URL_LENGTH, `originalUrl must be at most ${MAX_URL_LENGTH} characters`)
    .refine((value) => {
      try {
        const url = new URL(value)
        return HTTP_PROTOCOLS.has(url.protocol)
      } catch {
        return false
      }
    }, 'originalUrl must be a valid http(s) URL'),
  customAlias: z
    .string()
    .regex(SHORTCODE_PATTERN, 'customAlias must be 3-16 alphanumeric characters')
    .refine((value) => !RESERVED_ALIASES.has(value), 'customAlias is reserved')
    .optional(),
})

export type TShortenBody = z.infer<typeof shortenBodySchema>

export function parseShortenBody(body: unknown): TShortenBody {
  return shortenBodySchema.parse(body)
}

const redirectParamsSchema = z.object({
  shortCode: z.string().regex(SHORTCODE_PATTERN, 'shortCode must be 3-16 alphanumeric characters'),
})

export type TRedirectParams = z.infer<typeof redirectParamsSchema>

export function parseRedirectParams(params: unknown): TRedirectParams {
  return redirectParamsSchema.parse(params)
}
