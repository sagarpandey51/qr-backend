const jwt = require("jsonwebtoken");

// Authentication middleware
exports.authenticate = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again."
      });
    }
    
    return res.status(401).json({
      success: false,
      message: "Invalid token."
    });
  }
};

// Check if user is institution admin
exports.isInstitution = (req, res, next) => {
  if (req.user.type !== "institution") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Institution privileges required."
    });
  }
  next();
};

// Check if user is teacher
exports.isTeacher = (req, res, next) => {
  if (req.user.type !== "teacher") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Teacher privileges required."
    });
  }
  next();
};

// Check if user is student
exports.isStudent = (req, res, next) => {
  if (req.user.type !== "student") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Student privileges required."
    });
  }
  next();
};

// Check if user is teacher or institution
exports.isTeacherOrInstitution = (req, res, next) => {
  if (req.user.type !== "teacher" && req.user.type !== "institution") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Teacher or Institution privileges required."
    });
  }
  next();
};