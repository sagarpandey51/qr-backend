const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load environment variables
dotenv.config();

const app = express();

// ========== BASIC MIDDLEWARE SETUP FIRST ==========

// Request logging
app.use((req, res, next) => {
  console.log(`\n📨 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  
  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    console.log('📝 Body:', JSON.stringify(req.body, null, 2));
  }
  
  next();
});

// CORS - Simple and working
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://qr-frontend-henna.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));



// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========== DATABASE CONNECTION ==========

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/qr-attendance";
    console.log(`🔌 Attempting MongoDB connection...`);
    
    await mongoose.connect(mongoURI);
    
    console.log("✅ MongoDB connected successfully");
    
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

// Initialize database connection
connectDB();

// ========== BASIC TEST ENDPOINTS (No dependencies) ==========

// Simple test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ /api/test endpoint hit");
  res.json({
    success: true,
    message: "Backend is working!",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Health check endpoint
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
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "QR Attendance Backend is running 🚀",
    endpoints: {
      health: "GET /health",
      test: "GET /api/test",
      docs: "API documentation coming soon"
    }
  });
});

// ========== DYNAMIC ROUTE LOADING WITH ERROR HANDLING ==========

// Function to safely load routes
const loadRoute = (routePath, routeName) => {
  try {
    if (fs.existsSync(routePath)) {
      const routeModule = require(routePath);
      console.log(`✅ Loaded ${routeName} route module`);
      return routeModule;
    } else {
      console.warn(`⚠️ ${routeName} route file not found at ${routePath}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading ${routeName} route:`, error.message);
    return null;
  }
};

// Define routes with fallbacks
const routes = [
  { path: "./routes/auth", name: "auth", endpoint: "/api/auth" },
  { path: "./routes/qr", name: "qr", endpoint: "/api/qr" },
  { path: "./routes/attendance", name: "attendance", endpoint: "/api/attendance" },
  { path: "./routes/institution", name: "institution", endpoint: "/api/institution" },
  { path: "./routes/student", name: "student", endpoint: "/api/students" },
  { path: "./routes/teacher", name: "teacher", endpoint: "/api/teachers" }
];

console.log("\n📋 Setting up routes...");

// Load and apply routes
routes.forEach(route => {
  const routeModule = loadRoute(route.path, route.name);
  if (routeModule) {
    app.use(route.endpoint, routeModule);
    console.log(`   ✅ ${route.name} route mounted at ${route.endpoint}`);
  } else {
    // Create a basic route as fallback
    console.log(`   ⚠️ Creating fallback route for ${route.endpoint}`);
    app.use(route.endpoint, (req, res) => {
      res.status(501).json({
        success: false,
        message: `${route.name} route module is not available`,
        endpoint: `${req.method} ${req.originalUrl}`
      });
    });
  }
});

// ========== REGISTRATION ENDPOINTS WITH FALLBACK ==========

// Test registration endpoint (works without database)
app.post("/api/test-register", async (req, res) => {
  console.log("✅ /api/test-register endpoint hit");
  
  try {
    const { name, email, role = "student", institutionCode = "TEST001" } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: name and email"
      });
    }

    res.status(201).json({
      success: true,
      message: "Test registration successful!",
      data: {
        user: {
          id: "test_" + Date.now(),
          name,
          email,
          role,
          institutionCode,
          createdAt: new Date().toISOString(),
          note: "This is a test registration. Real routes may not be loaded."
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

// Fallback student registration
app.post("/api/students/register", (req, res) => {
  res.status(501).json({
    success: false,
    message: "Student registration route is not loaded. Using test endpoint instead.",
    alternative: "POST /api/test-register with {name, email, role: 'student'}",
    documentation: "Check if student routes are properly configured"
  });
});

// Fallback teacher registration
app.post("/api/teachers/register", (req, res) => {
  res.status(501).json({
    success: false,
    message: "Teacher registration route is not loaded. Using test endpoint instead.",
    alternative: "POST /api/test-register with {name, email, role: 'teacher'}",
    documentation: "Check if teacher routes are properly configured"
  });
});

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requested: `${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      "GET /",
      "GET /health",
      "GET /api/test",
      "POST /api/test-register",
      "POST /api/students/register",
      "POST /api/teachers/register"
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🚨 Global error handler:", err.message);
  console.error("Stack:", err.stack);
  
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  });
});

// ========== START SERVER ==========

const PORT = process.env.PORT || 5000;

// Check for required environment variables
if (!process.env.MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI not found in environment variables");
  console.warn("⚠️ Using default: mongodb://localhost:27017/qr-attendance");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 ========== SERVER STARTED ==========`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: GET http://localhost:${PORT}/api/test`);
  console.log(`📝 Test register: POST http://localhost:${PORT}/api/test-register`);
  console.log(`====================================\n`);
});

// Export for Render.com / Vercel
module.exports = app;