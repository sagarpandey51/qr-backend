const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const qrRoutes = require("./routes/qr");
const attendanceRoutes = require("./routes/attendance");
const institutionRoutes = require("./routes/institution");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");

const app = express();

/* =====================================================
   ✅ CORS MUST COME FIRST (VERY IMPORTANT)
===================================================== */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://qr-frontend-henna.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("❌ CORS BLOCKED:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ✅ IMPORTANT: handle preflight requests
app.options("*", cors());

/* =====================================================
   MIDDLEWARE
===================================================== */

// Body parsers (AFTER CORS)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`\n📨 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);

  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    console.log("📝 Body:", JSON.stringify(req.body, null, 2));
  }

  next();
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =====================================================
   DATABASE CONNECTION
===================================================== */

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/qr-attendance";

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected successfully");

    mongoose.connection.on("error", err => {
      console.error("❌ MongoDB error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

connectDB();

/* =====================================================
   TEST ENDPOINTS
===================================================== */

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend is working",
    time: new Date().toISOString()
  });
});

app.post("/api/test-register", (req, res) => {
  res.status(201).json({
    success: true,
    message: "Test register OK",
    data: req.body
  });
});

/* =====================================================
   ROUTES
===================================================== */

app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/institution", institutionRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);

/* =====================================================
   BASIC ENDPOINTS
===================================================== */

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "QR Attendance Backend Running 🚀"
  });
});

/* =====================================================
   ERROR HANDLING
===================================================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error("🚨 ERROR:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});

module.exports = app;
