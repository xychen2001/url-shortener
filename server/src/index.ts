import express from "express";
import { prisma } from "./db";
import cors from "cors";
import morgan from "morgan";
import * as urlController from "./url.controller";

const app = express();
const PORT = process.env.PORT || 3000;

// TODO: change origin to use .env
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
app.get("/:shortCode", urlController.handleRedirect);

app.post("/shorten", urlController.handleShorten);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
