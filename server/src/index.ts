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
    res.json({ status: "ok", url_count: count });
  } catch (err) {
    res.status(500).json({ status: "error", error: String(err) });
  }
});

app.post("/shorten", async (req, res) => {
  // TODO: Add controller that wraps validation and service

  const { originalUrl } = req.body;

  const shortCode = shortCodeGeneratorHelper.generateShortCode(originalUrl);

  try {
    const entry = await prisma.url.create({
      data: {
        shortCode,
        originalUrl,
      },
    });

    res.status(201).json({
      shortCode: entry.shortCode,
    });
  } catch (error) {
    // TODO: handle collisions
    res.status(500).json({ error: "Failed to create short URL" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
