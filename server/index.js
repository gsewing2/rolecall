import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import jobRoutes from "./routes/jobs.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  })
);

// Rate limiting — 20 searches per IP per hour
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait before searching again." },
});
app.use("/api", limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", jobRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "RoleCall",
    timestamp: new Date().toISOString(),
    env: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasRapidApiKey: !!process.env.RAPIDAPI_KEY,
      clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ RoleCall server running on port ${PORT}`);
  console.log(`   Anthropic key: ${process.env.ANTHROPIC_API_KEY ? "✓" : "✗ MISSING"}`);
  console.log(`   RapidAPI key:  ${process.env.RAPIDAPI_KEY ? "✓" : "✗ (web search fallback active)"}`);
  console.log(`   Client URL:    ${process.env.CLIENT_URL || "http://localhost:5173"}`);
});
