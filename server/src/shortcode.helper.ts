import { randomBytes } from "node:crypto";

// .toString() only allow up to Base 36 (numbers + lowercase alphabets)
// Indexing CHARACTERS allows us to include uppercase alphabets (BASE 62)
const CHARACTERS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORTCODE_LENGTH = 8;

export function generateShortCode(): string {
  const bytes = randomBytes(SHORTCODE_LENGTH);
  let shortCode = "";
  for (const byte of bytes) {
    shortCode += CHARACTERS.charAt(byte % CHARACTERS.length);
  }
  return shortCode;
}
