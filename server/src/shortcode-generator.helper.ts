export function generateShortCode(originalUrl: string): string {
  const shortCode = Math.random().toString(36).slice(2, 8);
  return shortCode;
}
