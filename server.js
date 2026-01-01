const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// Load environment variables
dotenv.config();

const app = express();

// ========== ENVIRONMENT CONFIG ==========
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

console.log(`🚀 Environment: ${isProduction ? "Production" : "Development"}`);
console.log(`🌍 Platform: ${isVercel ? "Vercel" : "Local"}`);
console.log(`📁 Working directory: ${__dirname}`);

// ========== MANUAL CORS MIDDLEWARE ==========
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://qr-frontend-henna.vercel.app",
  "https://qr-attendance-frontend.vercel.app",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

// ========== REQUEST LOGGING ==========
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const origin = req.headers.origin || "No origin";
  
  console.log(`\n📨 ${timestamp} ${method} ${url}`);
  console.log(`📍 Origin: ${origin}`);
  console.log(`👤 User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  
  if (method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    const bodyCopy = { ...req.body };
    // Hide sensitive data in logs
    ["password", "newPassword", "confirmPassword", "token", "secret"].forEach(field => {
      if (bodyCopy[field]) bodyCopy[field] = "[HIDDEN]";
    });
    
    console.log('📝 Request Body:', JSON.stringify(bodyCopy, null, 2).substring(0, 1000));
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
  console.log(`📁 Creating uploads directory: ${uploadsDir}`);
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));
console.log(`📁 Static files served from: ${uploadsDir}`);

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
    const atIndex = mongoURI.indexOf('@');
    const maskedURI = atIndex > 0 
      ? mongoURI.substring(0, atIndex).replace(/:[^:]+@/, ':***@') + mongoURI.substring(atIndex)
      : mongoURI.substring(0, 30) + '...';
    
    console.log(`🔌 Connecting to MongoDB: ${maskedURI}`);
    
    // MongoDB connection options
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };
    
    await mongoose.connect(mongoURI, options);
    
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database name: ${mongoose.connection.db?.databaseName || 'Unknown'}`);
    
    // Event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("⚠️ Running without database connection");
  }
};

connectDB();

// ========== BASIC ENDPOINTS ==========

// Root endpoint
app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusNames = ["Disconnected", "Connected", "Connecting", "Disconnecting"];
  
  res.json({
    success: true,
    message: "QR Attendance System API 🚀",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    database: {
      status: statusNames[dbStatus] || "Unknown",
      connected: dbStatus === 1
    },
    endpoints: {
      api: "/api",
      health: "/api/health",
      test: "/api/test",
      testRegister: "POST /api/test-register",
      auth: {
        institutionRegister: "POST /api/auth/institution/register",
        institutionLogin: "POST /api/auth/institution/login",
        teacherLogin: "POST /api/auth/teacher/login",
        studentLogin: "POST /api/auth/student/login",
        currentUser: "GET /api/auth/me"
      }
    }
  });
});

// API root
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "QR Attendance API v1.0",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Health check
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbConnected = dbStatus === 1;
  
  const healthData = {
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: isVercel,
    database: {
      connected: dbConnected,
      readyState: dbStatus,
      status: dbConnected ? "healthy" : "unhealthy"
    },
    system: {
      uptime: `${Math.round(process.uptime())} seconds`,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      },
      node: process.version
    }
  };
  
  res.status(200).json(healthData);
});

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log("✅ /api/test endpoint hit");
  
  res.json({
    success: true,
    message: "Backend API is working correctly!",
    timestamp: new Date().toISOString(),
    database: {
      status: mongoose.connection.readyState === 1 ? "✅ connected" : "❌ disconnected",
      readyState: mongoose.connection.readyState
    },
    server: {
      port: process.env.PORT || 5000,
      environment: process.env.NODE_ENV,
      uptime: `${Math.round(process.uptime())}s`
    },
    request: {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
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
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email format"
    });
  }
  
  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters long"
    });
  }
  
  // Create test JWT token
  const testToken = jwt.sign(
    { 
      userId: `test_${Date.now()}`, 
      email, 
      role,
      name,
      institutionCode: "TEST001",
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET || "test_secret_do_not_use_in_production",
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
      token: testToken,
      expiresIn: "7 days"
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
  
  // List files in routes directory
  try {
    const routeFiles = fs.readdirSync(routesDir);
    console.log(`📄 Route files found: ${routeFiles.join(', ')}`);
  } catch (err) {
    console.error("❌ Could not read routes directory:", err.message);
  }
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

let loadedRoutes = 0;

routeConfigs.forEach(config => {
  try {
    const routeFile = config.path + ".js";
    const routeIndexFile = path.join(config.path, "index.js");
    
    let routeModule;
    let loadedFrom = "";
    
    if (fs.existsSync(routeFile)) {
      routeModule = require(routeFile);
      loadedFrom = routeFile;
    } else if (fs.existsSync(config.path) && fs.existsSync(routeIndexFile)) {
      routeModule = require(config.path);
      loadedFrom = routeIndexFile;
    } else {
      console.warn(`⚠️ ${config.name} route not found: ${config.path}.js`);
      
      // Create a simple test route for missing routes
      const router = express.Router();
      
      router.get("/", (req, res) => {
        res.json({
          success: true,
          message: `${config.name} API`,
          endpoint: config.basePath,
          note: "This is a placeholder route. Actual implementation may be missing."
        });
      });
      
      router.get("/test", (req, res) => {
        res.json({
          success: true,
          message: `${config.name} test endpoint is working`,
          timestamp: new Date().toISOString()
        });
      });
      
      router.all("*", (req, res) => {
        res.status(501).json({
          success: false,
          error: "Route not implemented",
          message: `${config.name} routes are not fully available`,
          requested: `${req.method} ${req.originalUrl}`
        });
      });
      
      routeModule = router;
      loadedFrom = "placeholder";
    }
    
    app.use(config.basePath, routeModule);
    console.log(`✅ ${config.name} routes mounted at ${config.basePath} (${loadedFrom})`);
    loadedRoutes++;
    
  } catch (error) {
    console.error(`❌ Error loading ${config.name} routes:`, error.message);
    console.error(error.stack);
    
    // Create error response router
    const router = express.Router();
    router.all("*", (req, res) => {
      res.status(500).json({
        success: false,
        error: "Route loading failed",
        message: `Failed to load ${config.name} routes: ${error.message}`,
        endpoint: `${req.method} ${req.originalUrl}`
      });
    });
    
    app.use(config.basePath, router);
  }
});

console.log(`✅ ${loadedRoutes}/${routeConfigs.length} routes loaded successfully`);

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
      "GET /api/auth/me"
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🚨 Global Error Handler:");
  console.error("  Message:", err.message);
  console.error("  URL:", req.originalUrl);
  console.error("  Method:", req.method);
  if (err.stack && !isProduction) {
    console.error("  Stack:", err.stack);
  }
  
  // Handle specific error types
  let statusCode = err.status || 500;
  let errorMessage = isProduction ? "Something went wrong" : err.message;
  
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorMessage = "Validation Error: " + err.message;
  }
  
  if (err.code === 11000) {
    statusCode = 409;
    errorMessage = "Duplicate entry found";
  }
  
  res.status(statusCode).json({
    success: false,
    error: "Internal Server Error",
    message: errorMessage,
    ...(isProduction ? {} : { details: err.message, stack: err.stack })
  });
});

// ========== SERVER STARTUP ==========

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
  console.log(`   🏫 Institution Login: POST http://localhost:${PORT}/api/auth/institution/login`);  // FIXED: Changed Port to PORT
  console.log(`   👨‍🏫 Teacher Login: POST http://localhost:${PORT}/api/auth/teacher/login`);
  console.log(`   🎓 Student Login: POST http://localhost:${PORT}/api/auth/student/login`);
  console.log(`   👤 Current User: GET http://localhost:${PORT}/api/auth/me`);
  console.log(`\n📝 Test Registration: POST http://localhost:${PORT}/api/test-register`);
  console.log(`========================================\n`);
  
  // Database status
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: "❌ Disconnected",
    1: "✅ Connected", 
    2: "🔄 Connecting",
    3: "⚠️ Disconnecting"
  };
  console.log(`🗄️ Database Status: ${statusMap[dbStatus] || "Unknown"}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${PORT} is already in use.`);
    console.error(`   Try: kill -9 $(lsof -ti:${PORT}) or change PORT in .env`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time. Forcing shutdown.');
    process.exit(1);
  }, 10000);
});

// Export for Vercel
module.exports = app;