const express = require("express");
const router = express.Router();
const qrController = require("../controllers/qrController");
const authMiddleware = require("../middleware/authMiddleware");

// 👨‍🏫 Teacher Routes (Protected)
router.post("/generate", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  qrController.generateQR
);

router.post("/refresh", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  qrController.refreshQR
);

router.get("/sessions", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  qrController.getActiveSessions
);

// 🎓 Student Routes (Protected)
router.post("/scan", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  qrController.scanQR // This will be markAttendance in attendanceController
);

// 👨‍💼 Admin/Institution Routes (Protected)
router.get("/institution-sessions", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  qrController.getInstitutionSessions
);

module.exports = router;