// .toString() only allow up to Base 36 (numbers + lowercase alphabets)
// Indexing CHARACTERS allows us to include uppercase alphabets (BASE 62)
const CHARACTERS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHORTCODE_LENGTH = 8;

export function generateShortCode(): string {
  let shortCode = "";
  for (let i = 0; i < SHORTCODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * CHARACTERS.length);
    shortCode += CHARACTERS[index];
  }
  return shortCode;
}
