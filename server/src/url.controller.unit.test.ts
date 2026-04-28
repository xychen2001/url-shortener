import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Request, Response } from "express";
import * as urlServiceModule from "./url.service";

const realUrlServiceExports = { ...urlServiceModule };

const getOriginalUrl = mock();
const createShortUrl = mock();

mock.module("./url.service", () => ({ getOriginalUrl, createShortUrl }));

const { handleRedirect, handleShorten } = await import("./url.controller");

type TFakeRes = {
  status: ReturnType<typeof mock>;
  json: ReturnType<typeof mock>;
  redirect: ReturnType<typeof mock>;
};

function makeRes(): TFakeRes {
  const res: TFakeRes = {
    status: mock(),
    json: mock(),
    redirect: mock(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  getOriginalUrl.mockReset();
  createShortUrl.mockReset();
});

afterAll(() => {
  mock.module("./url.service", () => realUrlServiceExports);
});

describe("handleRedirect", () => {
  it("redirects with 302 to the original URL when found", async () => {
    const row = {
      id: 1,
      shortCode: "abcd1234",
      originalUrl: "https://example.com",
      createdAt: new Date(),
    };
    getOriginalUrl.mockResolvedValueOnce(row);
    const req = { params: { shortCode: "abcd1234" } } as unknown as Request<{
      shortCode: string;
    }>;
    const res = makeRes();

    await handleRedirect(req, res as unknown as Response);

    expect(getOriginalUrl).toHaveBeenCalledWith("abcd1234");
    expect(res.redirect).toHaveBeenCalledWith(302, "https://example.com");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 404 when no matching url exists", async () => {
    getOriginalUrl.mockResolvedValueOnce(null);
    const req = { params: { shortCode: "abcd1234" } } as unknown as Request<{
      shortCode: string;
    }>;
    const res = makeRes();

    await handleRedirect(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "No matching url found" });
  });

  it("returns 400 when shortCode params fail validation", async () => {
    const req = { params: { shortCode: "bad" } } as unknown as Request<{
      shortCode: string;
    }>;
    const res = makeRes();

    await handleRedirect(req, res as unknown as Response);

    expect(getOriginalUrl).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.error).toBe("Invalid short code");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 500 when the service throws an unknown error", async () => {
    getOriginalUrl.mockRejectedValueOnce(new Error("db down"));
    const req = { params: { shortCode: "abcd1234" } } as unknown as Request<{
      shortCode: string;
    }>;
    const res = makeRes();

    await handleRedirect(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("handleShorten", () => {
  it("returns 201 with the shortCode when creation succeeds", async () => {
    const entry = {
      id: 1,
      shortCode: "code0001",
      originalUrl: "https://example.com",
      createdAt: new Date(),
    };
    createShortUrl.mockResolvedValueOnce(entry);
    const req = {
      body: { originalUrl: "https://example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleShorten(req, res as unknown as Response);

    expect(createShortUrl).toHaveBeenCalledWith("https://example.com");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ shortCode: "code0001" });
  });

  it("returns 500 with a retry message when shortcode allocation is exhausted", async () => {
    createShortUrl.mockResolvedValueOnce(null);
    const req = {
      body: { originalUrl: "https://example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleShorten(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Could not allocate a unique short code, please retry",
    });
  });

  it("returns 400 when the body fails validation", async () => {
    const req = { body: { originalUrl: "not a url" } } as unknown as Request;
    const res = makeRes();

    await handleShorten(req, res as unknown as Response);

    expect(createShortUrl).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0]?.[0];
    expect(body.error).toBe("Invalid request body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 500 when the service throws an unknown error", async () => {
    createShortUrl.mockRejectedValueOnce(new Error("db down"));
    const req = {
      body: { originalUrl: "https://example.com" },
    } as unknown as Request;
    const res = makeRes();

    await handleShorten(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to create short URL",
    });
  });
});
