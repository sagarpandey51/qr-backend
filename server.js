const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load environment variables
dotenv.config();

const app = express();

// ========== ENVIRONMENT CONFIG ==========
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

console.log(`🚀 Environment: ${isProduction ? "Production" : "Development"}`);
console.log(`🌍 Platform: ${isVercel ? "Vercel" : "Local"}`);

// ========== CORS CONFIGURATION ==========
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://qr-frontend-henna.vercel.app",
  "https://qr-attendance-frontend.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin && isProduction) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// ========== REQUEST LOGGING ==========
app.use((req, res, next) => {
  console.log(`\n📨 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  console.log(`📍 Origin: ${req.headers.origin || "No origin"}`);
  console.log(`🔑 Auth: ${req.headers.authorization ? "Present" : "Not present"}`);
  
  // Log body for non-GET requests (but limit size for readability)
  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    const bodyCopy = { ...req.body };
    // Hide password in logs
    if (bodyCopy.password) bodyCopy.password = "[HIDDEN]";
    if (bodyCopy.newPassword) bodyCopy.newPassword = "[HIDDEN]";
    if (bodyCopy.confirmPassword) bodyCopy.confirmPassword = "[HIDDEN]";
    
    console.log('📝 Request Body:', JSON.stringify(bodyCopy, null, 2));
  }
  
  next();
});

// ========== BODY PARSERS ==========
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || "10mb"
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || "10mb" 
}));

// ========== STATIC FILES ==========
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// ========== DATABASE CONNECTION ==========
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error("❌ MONGODB_URI is not defined in environment variables");
      console.error("⚠️ Please check your .env file");
      return;
    }
    
    // Log masked URI for security
    const maskedURI = mongoURI.substring(0, mongoURI.indexOf('@') + 1) + '***@***';
    console.log(`🔌 Connecting to MongoDB: ${maskedURI}`);
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    await mongoose.connect(mongoURI, options);
    
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    // Event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    // Log collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Collections: ${collections.map(c => c.name).join(', ')}`);
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("⚠️ Running without database connection");
  }
};

connectDB();

// ========== BASIC ENDPOINTS ==========

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "QR Attendance System API 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    database: {
      status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState
    },
    endpoints: {
      api: "/api",
      health: "/api/health",
      test: "/api/test",
      auth: {
        institution: {
          register: "POST /api/auth/institution/register",
          login: "POST /api/auth/institution/login"
        },
        teacher: {
          login: "POST /api/auth/teacher/login"
        },
        student: {
          login: "POST /api/auth/student/login"
        },
        currentUser: "GET /api/auth/me",
        changePassword: "POST /api/auth/change-password"
      }
    }
  });
});

// API root
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "QR Attendance API v1.0",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Health check
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbConnected = dbStatus === 1;
  
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: isVercel,
    database: {
      connected: dbConnected,
      readyState: dbStatus,
      states: {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
      }
    },
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())} seconds`
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ /api/test endpoint hit");
  res.json({
    success: true,
    message: "Backend API is working correctly!",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "✅ connected" : "❌ disconnected",
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      headers: {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent']
      }
    }
  });
});

// Test registration endpoint (for testing without auth)
app.post("/api/test-register", (req, res) => {
  console.log("📝 Test registration received");
  
  const { name, email, role = "student", password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Name, email and password are required"
    });
  }
  
  // Create test JWT token
  const testToken = jwt.sign(
    { 
      userId: `test_${Date.now()}`, 
      email, 
      role,
      name,
      institutionCode: "TEST001"
    },
    process.env.JWT_SECRET || "test_secret",
    { expiresIn: "7d" }
  );
  
  res.status(201).json({
    success: true,
    message: "Test registration successful",
    data: {
      user: {
        id: `test_${Date.now()}`,
        name,
        email,
        role,
        institutionCode: "TEST001",
        createdAt: new Date().toISOString()
      },
      token: testToken
    }
  });
});

// ========== LOAD ROUTES ==========
console.log("\n📋 Loading API routes...");

// Check if routes directory exists
const routesDir = path.join(__dirname, "routes");
if (!fs.existsSync(routesDir)) {
  console.error("❌ Routes directory not found!");
  console.error("⚠️ Please create a 'routes' folder with your route files");
} else {
  console.log(`✅ Routes directory found at: ${routesDir}`);
}

// List of routes to load
const routeConfigs = [
  { path: "./routes/auth", name: "Authentication", basePath: "/api/auth" },
  { path: "./routes/qr", name: "QR Code", basePath: "/api/qr" },
  { path: "./routes/attendance", name: "Attendance", basePath: "/api/attendance" },
  { path: "./routes/institution", name: "Institution", basePath: "/api/institution" },
  { path: "./routes/student", name: "Student", basePath: "/api/students" },
  { path: "./routes/teacher", name: "Teacher", basePath: "/api/teachers" }
];

// Import jwt for test endpoint (add at top if not already)
const jwt = require("jsonwebtoken");

routeConfigs.forEach(config => {
  try {
    // Check for .js file or index.js in folder
    const routeFile = config.path + ".js";
    const routeDir = config.path;
    
    if (fs.existsSync(routeFile)) {
      const routeModule = require(config.path);
      app.use(config.basePath, routeModule);
      console.log(`✅ ${config.name} routes mounted at ${config.basePath}`);
    } else if (fs.existsSync(routeDir) && fs.existsSync(path.join(routeDir, "index.js"))) {
      const routeModule = require(config.path);
      app.use(config.basePath, routeModule);
      console.log(`✅ ${config.name} routes mounted at ${config.basePath} (from index.js)`);
    } else {
      console.warn(`⚠️ ${config.name} route not found: ${config.path}.js`);
      
      // Create a simple test route for missing routes
      const router = express.Router();
      
      router.get("/test", (req, res) => {
        res.json({
          success: true,
          message: `${config.name} routes are working`,
          endpoint: config.basePath,
          note: "This is a test endpoint. Actual routes may not be loaded."
        });
      });
      
      router.all("*", (req, res) => {
        res.status(501).json({
          success: false,
          error: "Route not fully implemented",
          message: `${config.name} routes are partially available`,
          endpoint: `${req.method} ${req.originalUrl}`,
          available: `${config.basePath}/test`
        });
      });
      
      app.use(config.basePath, router);
    }
  } catch (error) {
    console.error(`❌ Error loading ${config.name} routes:`, error.message);
    
    // Create error response router
    const router = express.Router();
    router.all("*", (req, res) => {
      res.status(500).json({
        success: false,
        error: "Route loading failed",
        message: `Failed to load ${config.name} routes: ${error.message}`,
        endpoint: `${req.method} ${req.originalUrl}`,
        stack: isProduction ? undefined : error.stack
      });
    });
    
    app.use(config.basePath, router);
  }
});

console.log("✅ All routes loaded");

// ========== ERROR HANDLING ==========

// 404 Handler
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requested: `${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      "GET /",
      "GET /api",
      "GET /api/health",
      "GET /api/test",
      "POST /api/test-register",
      "POST /api/auth/institution/register",
      "POST /api/auth/institution/login",
      "POST /api/auth/teacher/login",
      "POST /api/auth/student/login",
      "GET /api/auth/me",
      "GET /api/students/test",
      "GET /api/teachers/test"
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🚨 Global Error:", {
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    stack: isProduction ? undefined : err.stack
  });
  
  // Handle CORS errors
  if (err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      error: "CORS Error",
      message: err.message,
      allowedOrigins: allowedOrigins
    });
  }
  
  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: "Authentication Error",
      message: "Invalid token"
    });
  }
  
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Authentication Error",
      message: "Token expired"
    });
  }
  
  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      message: err.message
    });
  }
  
  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      error: "Duplicate Entry",
      message: `${field} already exists`
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: "Internal Server Error",
    message: isProduction ? "Something went wrong" : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// ========== SERVER STARTUP ==========

// Only start the server if not on Vercel
if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 ========== SERVER STARTED ==========`);
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
    console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
    console.log(`\n🔐 AUTHENTICATION ENDPOINTS:`);
    console.log(`   🏫 Institution Register: POST http://localhost:${PORT}/api/auth/institution/register`);
    console.log(`   🏫 Institution Login: POST http://localhost:${PORT}/api/auth/institution/login`);
    console.log(`   👨‍🏫 Teacher Login: POST http://localhost:${PORT}/api/auth/teacher/login`);
    console.log(`   🎓 Student Login: POST http://localhost:${PORT}/api/auth/student/login`);
    console.log(`   👤 Current User: GET http://localhost:${PORT}/api/auth/me`);
    console.log(`\n📝 Test Registration: POST http://localhost:${PORT}/api/test-register`);
    console.log(`========================================\n`);
    
    // Database status
    const dbStatus = mongoose.connection.readyState;
    const statusMessages = ["Disconnected", "Connected", "Connecting", "Disconnecting"];
    console.log(`🗄️ Database Status: ${statusMessages[dbStatus]}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      console.error('Try:');
      console.error('  1. Kill the process using port:', PORT);
      console.error('  2. Change PORT in .env file');
      console.error('  3. Run: lsof -ti:5000 | xargs kill -9 (on Mac/Linux)');
    }
  });
  
  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('\n⚠️ Shutting down gracefully...');
    server.close(() => {
      console.log('✅ HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcing shutdown');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Export for Vercel
module.exports = app;