const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");

// 🎓 Student Attendance Routes
router.post("/mark", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  attendanceController.markAttendance
);

router.get("/my-attendance", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  attendanceController.getMyAttendance
);

router.get("/my-report", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  attendanceController.getAttendanceReport
);

// 👨‍🏫 Teacher Attendance Routes
router.get("/class-attendance", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  attendanceController.getClassAttendance
);

router.get("/subject-report", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  attendanceController.getSubjectReport
);

router.get("/daily-summary", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  attendanceController.getDailySummary
);

// 👨‍💼 Institution Admin Routes
router.get("/institution-report", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  attendanceController.getInstitutionReport
);

router.get("/class-wise", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  attendanceController.getClassWiseReport
);

router.get("/export", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  attendanceController.exportAttendance
);

module.exports = router;