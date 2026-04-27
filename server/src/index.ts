import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import cors from "cors";
import morgan from "morgan";
import * as shortCodeGeneratorHelper from "./shortcode-generator.helper";

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SHORTCODE_ATTEMPTS = 3;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", async (_req, res) => {
  try {
    const count = await prisma.url.count();
    return res.json({ status: "ok", url_count: count });
  } catch (err) {
    return res.status(500).json({ status: "error", error: String(err) });
  }
});

//TODO - serve 404 not found page
//TODO - allow user to decide shortCode
app.get("/:shortCode", async (req, res) => {
  const { shortCode } = req.params;
  try {
    const url = await prisma.url.findUnique({
      where: {
        shortCode,
      },
    });

    if (!url) {
      return res.status(404).json({ error: "No matching url found" });
    }

    return res.redirect(302, url.originalUrl);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/shorten", async (req, res) => {
  // TODO: Add controller that wraps validation and service

  const { originalUrl } = req.body;

  // Retry handles shortCode collisions
  for (let attempt = 0; attempt < MAX_SHORTCODE_ATTEMPTS; attempt++) {
    const shortCode = shortCodeGeneratorHelper.generateShortCode();

    try {
      //TODO: make originalUrl unique field by using upsert
      const entry = await prisma.url.create({
        data: {
          shortCode,
          originalUrl,
        },
      });

      return res.status(201).json({
        shortCode: entry.shortCode,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      return res.status(500).json({ error: "Failed to create short URL" });
    }
  }

  return res.status(500).json({
    error: "Could not allocate a unique short code, please retry",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
