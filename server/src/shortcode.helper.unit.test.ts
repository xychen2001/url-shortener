import { describe, expect, it } from 'bun:test'
import { generateShortCode } from './shortcode.helper'

const BASE62_PATTERN = /^[0-9A-Za-z]+$/

describe('generateShortCode', () => {
  it('returns a string of length 8', () => {
    expect(generateShortCode()).toHaveLength(8)
  })

  it('only uses base62 characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShortCode()).toMatch(BASE62_PATTERN)
    }
  })

  it('produces a high uniqueness ratio across many calls', () => {
    const total = 1000
    const codes = new Set<string>()
    for (let i = 0; i < total; i++) {
      codes.add(generateShortCode())
    }
    expect(codes.size / total).toBeGreaterThan(0.95)
  })
})
