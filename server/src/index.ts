import express from "express";
import { prisma } from "./db";
import cors from "cors";
import morgan from "morgan";
import * as shortCodeGeneratorHelper from "./shortcode-generator.helper";

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get("/:shortCode", async (req, res) => {
  //TODO - return originalUrl based on shortCode

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

    //TODO: possibly add redirect here
    return res.status(200).json({
      originalUrl: url.originalUrl,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/shorten", async (req, res) => {
  // TODO: Add controller that wraps validation and service

  const { originalUrl } = req.body;

  const shortCode = shortCodeGeneratorHelper.generateShortCode(originalUrl);

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
    // TODO: handle collisions
    return res.status(500).json({ error: "Failed to create short URL" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
