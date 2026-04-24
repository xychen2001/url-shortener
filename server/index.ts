import express from "express";
import { prisma } from "./db";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    const count = await prisma.url.count();
    res.json({ status: "ok", url_count: count });
  } catch (err) {
    res.status(500).json({ status: "error", error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
