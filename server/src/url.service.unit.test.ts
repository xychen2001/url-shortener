import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { Prisma } from "@prisma/client";
import * as dbModule from "./db";
import * as shortCodeHelperModule from "./shortcode.helper";

const realDbExports = { ...dbModule };
const realHelperExports = { ...shortCodeHelperModule };

const findUnique = mock();
const create = mock();
const generateShortCode = mock();

mock.module("./db", () => ({
  prisma: { url: { findUnique, create } },
}));
mock.module("./shortcode.helper", () => ({ generateShortCode }));

const { getOriginalUrl, createShortUrl } = await import("./url.service");

function makeCollisionError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  generateShortCode.mockReset();
});

afterAll(() => {
  mock.module("./db", () => realDbExports);
  mock.module("./shortcode.helper", () => realHelperExports);
});

describe("getOriginalUrl", () => {
  it("queries Prisma by shortCode and returns the row", async () => {
    const row = {
      id: 1,
      shortCode: "abcd1234",
      originalUrl: "https://example.com",
      createdAt: new Date(),
    };
    findUnique.mockResolvedValueOnce(row);

    const result = await getOriginalUrl("abcd1234");

    expect(findUnique).toHaveBeenCalledWith({ where: { shortCode: "abcd1234" } });
    expect(result).toEqual(row);
  });

  it("returns null when no row is found", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await getOriginalUrl("abcd1234")).toBeNull();
  });
});

describe("createShortUrl", () => {
  it("returns the entry on the first successful create", async () => {
    const entry = {
      id: 1,
      shortCode: "code0001",
      originalUrl: "https://example.com",
      createdAt: new Date(),
    };
    generateShortCode.mockReturnValueOnce("code0001");
    create.mockResolvedValueOnce(entry);

    const result = await createShortUrl("https://example.com");

    expect(result).toEqual(entry);
    expect(generateShortCode).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { shortCode: "code0001", originalUrl: "https://example.com" },
    });
  });

  it("retries on a P2002 collision and succeeds on the next attempt", async () => {
    const entry = {
      id: 2,
      shortCode: "code0002",
      originalUrl: "https://example.com",
      createdAt: new Date(),
    };
    generateShortCode
      .mockReturnValueOnce("code0001")
      .mockReturnValueOnce("code0002");
    create
      .mockRejectedValueOnce(makeCollisionError())
      .mockResolvedValueOnce(entry);

    const result = await createShortUrl("https://example.com");

    expect(result).toEqual(entry);
    expect(generateShortCode).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("returns null after MAX_SHORTCODE_ATTEMPTS consecutive collisions", async () => {
    generateShortCode
      .mockReturnValueOnce("code0001")
      .mockReturnValueOnce("code0002")
      .mockReturnValueOnce("code0003");
    create
      .mockRejectedValueOnce(makeCollisionError())
      .mockRejectedValueOnce(makeCollisionError())
      .mockRejectedValueOnce(makeCollisionError());

    const result = await createShortUrl("https://example.com");

    expect(result).toBeNull();
    expect(generateShortCode).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("rethrows non-collision errors", async () => {
    generateShortCode.mockReturnValueOnce("code0001");
    create.mockRejectedValueOnce(new Error("connection refused"));

    expect(createShortUrl("https://example.com")).rejects.toThrow(
      "connection refused",
    );
  });
});
