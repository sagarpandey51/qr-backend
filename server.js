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

// ========== MIDDLEWARE ==========

// Request logging
app.use((req, res, next) => {
  console.log(`\n📨 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  
  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    console.log('📝 Body:', JSON.stringify(req.body, null, 2));
  }
  
  next();
});

// CORS - Simple and working
app.use(cors());

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========== DATABASE CONNECTION ==========

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/qr-attendance";
    console.log(`🔌 Connecting to MongoDB: ${mongoURI}`);
    
    // ✅ FIXED: Removed deprecated options
    await mongoose.connect(mongoURI);
    
    console.log("✅ MongoDB connected successfully");
    
    // Connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("⚠️ Running without database connection");
  }
};

connectDB();

// ========== TEST ENDPOINTS ==========

// Simple test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ /api/test endpoint hit");
  res.json({
    success: true,
    message: "Backend is working!",
    timestamp: new Date().toISOString()
  });
});

// Test registration endpoint
app.post("/api/test-register", async (req, res) => {
  console.log("✅ /api/test-register endpoint hit");
  
  try {
    const data = req.body;
    console.log("📦 Request data:", data);
    
    if (!data.name || !data.email) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields"
      });
    }

    res.status(201).json({
      success: true,
      message: "Test registration successful!",
      data: {
        user: {
          id: "test_" + Date.now(),
          name: data.name,
          email: data.email,
          role: data.role || "student",
          institutionCode: data.institutionCode || "TEST001",
          createdAt: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Test register error:", error);
    res.status(500).json({
      success: false,
      error: "Test registration failed",
      details: error.message
    });
  }
});

// ========== ROUTES SETUP ==========

console.log("📋 Setting up routes...");

// Check if routes exist
console.log("🔍 Checking route modules...");
console.log("   authRoutes:", typeof authRoutes);
console.log("   teacherRoutes:", typeof teacherRoutes);
console.log("   studentRoutes:", typeof studentRoutes);

// Apply routes
app.use("/api/auth", authRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/institution", institutionRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);

console.log("✅ All routes applied");

// ========== BASIC ENDPOINTS ==========

app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbConnected = dbStatus === 1;
  
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: {
      status: dbConnected ? "connected" : "disconnected",
      connected: dbConnected
    },
    uptime: process.uptime()
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "QR Attendance Backend is running 🚀",
    endpoints: {
      health: "GET /health",
      test: "GET /api/test",
      testRegister: "POST /api/test-register",
      students: {
        register: "POST /api/students/register"
      },
      teachers: {
        register: "POST /api/teachers/register"
      }
    }
  });
});

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err.message);
  
  res.status(500).json({
    success: false,
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// ========== START SERVER ==========

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 ========== SERVER STARTED ==========`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: GET http://localhost:${PORT}/api/test`);
  console.log(`👨‍🎓 Student register: POST http://localhost:${PORT}/api/students/register`);
  console.log(`👨‍🏫 Teacher register: POST http://localhost:${PORT}/api/teachers/register`);
  console.log(`====================================\n`);
});

// ✅ ADD THIS FOR RENDER.COM
module.exports = app;