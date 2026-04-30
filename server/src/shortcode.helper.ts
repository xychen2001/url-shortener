import { randomBytes } from "node:crypto";

//BASE 62
const CHARACTERS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORTCODE_LENGTH = 8;

//Using randomBytes() is more secure than Math.random()
export function generateShortCode(): string {
  const bytes = randomBytes(SHORTCODE_LENGTH);
  let shortCode = "";
  for (const byte of bytes) {
    shortCode += CHARACTERS.charAt(byte % CHARACTERS.length);
  }
  return shortCode;
}
