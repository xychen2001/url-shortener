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

  it("accepts a valid customAlias", () => {
    expect(
      parseShortenBody({
        originalUrl: "https://example.com",
        customAlias: "myLink",
      }),
    ).toEqual({
      originalUrl: "https://example.com",
      customAlias: "myLink",
    });
  });

  it("accepts a body without customAlias", () => {
    expect(parseShortenBody({ originalUrl: "https://example.com" })).toEqual({
      originalUrl: "https://example.com",
    });
  });

  it("throws when customAlias is shorter than 3 characters", () => {
    expect(() =>
      parseShortenBody({
        originalUrl: "https://example.com",
        customAlias: "ab",
      }),
    ).toThrow(ZodError);
  });

  it("throws when customAlias is longer than 16 characters", () => {
    expect(() =>
      parseShortenBody({
        originalUrl: "https://example.com",
        customAlias: "a".repeat(17),
      }),
    ).toThrow(ZodError);
  });

  it("throws when customAlias contains non-base62 characters", () => {
    expect(() =>
      parseShortenBody({
        originalUrl: "https://example.com",
        customAlias: "my-link",
      }),
    ).toThrow(ZodError);
  });

  it("throws when customAlias is a reserved word", () => {
    expect(() =>
      parseShortenBody({
        originalUrl: "https://example.com",
        customAlias: "admin",
      }),
    ).toThrow(ZodError);
  });
});

describe("parseRedirectParams", () => {
  it("accepts an 8-character auto-generated shortCode", () => {
    expect(parseRedirectParams({ shortCode: "aB3dE9fG" })).toEqual({
      shortCode: "aB3dE9fG",
    });
  });

  it("accepts a custom alias shorter than 8 characters", () => {
    expect(parseRedirectParams({ shortCode: "myLink" })).toEqual({
      shortCode: "myLink",
    });
  });

  it("accepts a custom alias longer than 8 characters", () => {
    expect(parseRedirectParams({ shortCode: "myReallyLongOne" })).toEqual({
      shortCode: "myReallyLongOne",
    });
  });

  it("throws on a 2-character shortCode", () => {
    expect(() => parseRedirectParams({ shortCode: "ab" })).toThrow(ZodError);
  });

  it("throws on a 17-character shortCode", () => {
    expect(() => parseRedirectParams({ shortCode: "a".repeat(17) })).toThrow(
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
