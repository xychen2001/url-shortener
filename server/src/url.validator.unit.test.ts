import { describe, expect, it } from "bun:test";
import { ZodError } from "zod";
import { parseRedirectParams, parseShortenBody } from "./url.validator";

describe("parseShortenBody", () => {
  it("accepts an http URL", () => {
    expect(parseShortenBody({ originalUrl: "http://example.com" })).toEqual({
      originalUrl: "http://example.com",
    });
  });

  it("accepts an https URL with path and query", () => {
    const originalUrl = "https://example.com/path?q=1";
    expect(parseShortenBody({ originalUrl })).toEqual({ originalUrl });
  });

  it("throws on an empty string", () => {
    expect(() => parseShortenBody({ originalUrl: "" })).toThrow(ZodError);
  });

  it("throws when the URL exceeds the max length", () => {
    const tooLong = `https://example.com/${"a".repeat(2049)}`;
    expect(() => parseShortenBody({ originalUrl: tooLong })).toThrow(ZodError);
  });

  it("throws on a non-http(s) protocol", () => {
    expect(() => parseShortenBody({ originalUrl: "ftp://example.com" })).toThrow(
      ZodError,
    );
  });

  it("throws on a malformed URL string", () => {
    expect(() => parseShortenBody({ originalUrl: "not a url" })).toThrow(
      ZodError,
    );
  });

  it("throws when originalUrl is missing", () => {
    expect(() => parseShortenBody({})).toThrow(ZodError);
  });
});

describe("parseRedirectParams", () => {
  it("accepts an 8-character alphanumeric shortCode", () => {
    expect(parseRedirectParams({ shortCode: "aB3dE9fG" })).toEqual({
      shortCode: "aB3dE9fG",
    });
  });

  it("throws on a 7-character shortCode", () => {
    expect(() => parseRedirectParams({ shortCode: "abcdefg" })).toThrow(
      ZodError,
    );
  });

  it("throws on a 9-character shortCode", () => {
    expect(() => parseRedirectParams({ shortCode: "abcdefghi" })).toThrow(
      ZodError,
    );
  });

  it("throws on a shortCode with non-base62 characters", () => {
    expect(() => parseRedirectParams({ shortCode: "abc-defg" })).toThrow(
      ZodError,
    );
  });

  it("throws when shortCode is missing", () => {
    expect(() => parseRedirectParams({})).toThrow(ZodError);
  });
});
