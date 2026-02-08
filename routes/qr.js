const express = require("express");
const router = express.Router();
const qrController = require("../controllers/qrController");
const authMiddleware = require("../middleware/authMiddleware");

// 👨‍🏫 TEACHER SELF-ATTENDANCE QR
router.post("/teacher/generate", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  qrController.generateTeacherSelfQR
);

// 🔄 SCAN TEACHER QR (Remove auth for testing)
router.post("/teacher/scan",
  qrController.scanTeacherQR
);

// 🧪 TEST ENDPOINT (No auth, no QR)
router.post("/test/teacher",
  qrController.testTeacherScan
);

// 🎓 STUDENT SCANS CLASS QR (Keep existing)
router.post("/scan", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  qrController.scanQR
);

// 👨‍🏫 TEACHER GENERATES CLASS QR (Keep existing)
router.post("/generate", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  qrController.generateQR
);

module.exports = router;