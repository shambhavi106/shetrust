require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
require("dotenv").config(); // fallback - also try local .env

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── Initialise Socket.io ────────────────────────────────────────────
const io = initSocket(server);

// ── Security middleware ─────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Auth-Token"], // so frontend can capture new anon tokens
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});

const ratingsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // max 20 rating submissions per hour per IP
  message: {
    success: false,
    error: "Rating submission limit reached. Try again later.",
  },
});

app.use(globalLimiter);

// ── Routes ──────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth")); // from friend
app.use("/api/locations", require("./routes/locations"));
app.use("/api/ratings", ratingsLimiter, require("./routes/ratings"));
app.use("/api/chat", require("./routes/chat")); // from you
app.use("/api/survey", require("./routes/survey"));

// ── Health check ────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SheTrust API",
    version: "1.0.0",
    city: "Bengaluru",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date(),
  });
});

// ── 404 handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ── MongoDB connection ──────────────────────────────────────────────
const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/shetrust";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Auto-seed if database is empty
    const Location = require("./models/Location");
    const count = await Location.countDocuments();
    if (count === 0) {
      console.log("🌱 Database empty, seeding...");
      require("./utils/seed.js");
    } else {
      console.log(`📍 ${count} locations already in database`);
    }

    server.listen(PORT, () => {
      console.log(`\n🛡  SheTrust API running on http://localhost:${PORT}`);
      console.log(`📍 City: Bengaluru`);
      console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔌 Socket.io: enabled\n`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ── MongoDB connection events ───────────────────────────────────────
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected");
});

module.exports = app;
