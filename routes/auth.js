const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// 🏫 Institution Auth (Public)
router.post("/institution/register", authController.registerInstitution);
router.post("/institution/login", authController.loginInstitution);

// 👨‍🏫 Teacher Auth (Public)
router.post("/teacher/login", authController.loginTeacher);

// 🎓 Student Auth (Public)
router.post("/student/login", authController.loginStudent);

// 🔄 Get Current User (Protected - all users)
router.get("/me", 
  authMiddleware.authenticate, 
  authController.getCurrentUser
);

// 🔐 Change Password (Protected)
router.post("/change-password", 
  authMiddleware.authenticate, 
  authController.changePassword
);

// 📧 Forgot Password (Public)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// 📱 Update Device Token (Protected)
router.post("/update-fcm", 
  authMiddleware.authenticate, 
  authController.updateFCMToken
);

module.exports = router;