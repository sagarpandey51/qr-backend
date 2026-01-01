const express = require("express");
const router = express.Router();
const institutionController = require("../controllers/institutionController");
const authMiddleware = require("../middleware/authMiddleware");

// 👨‍💼 Institution Management (Protected)
router.get("/dashboard", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getDashboardStats
);

router.get("/students", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getAllStudents
);

router.get("/teachers", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getAllTeachers
);

router.post("/add-student", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.addStudent
);

router.post("/add-teacher", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.addTeacher
);

router.put("/update-profile", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.updateInstitutionProfile
);

router.get("/attendance-summary", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getAttendanceSummary
);

router.get("/reports/daily", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getDailyReport
);

router.get("/reports/monthly", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.getMonthlyReport
);

// Bulk operations
router.post("/bulk-upload-students", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.bulkUploadStudents
);

router.post("/bulk-upload-teachers", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.bulkUploadTeachers
);

// Student/Teacher management
router.put("/students/:id/status", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.updateStudentStatus
);

router.put("/teachers/:id/status", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.updateTeacherStatus
);

router.delete("/students/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.deleteStudent
);

router.delete("/teachers/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  institutionController.deleteTeacher
);

module.exports = router;