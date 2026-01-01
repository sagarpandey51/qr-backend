const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ ADD THIS: Public registration route for new students
router.post("/register", studentController.registerStudent);
// OR if you prefer "join" or "enroll"
// router.post("/join", studentController.registerStudent);
// router.post("/enroll", studentController.registerStudent);

// 🎓 Student Profile (Protected)
router.get("/profile", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getProfile
);

router.put("/update-profile", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.updateProfile
);

router.put("/change-password", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.changePassword
);

// 📚 Student Academics
router.get("/timetable", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getTimetable
);

router.get("/subjects", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getSubjects
);

// 📊 Attendance
router.get("/attendance/overview", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getAttendanceOverview
);

router.get("/attendance/subject-wise", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getSubjectWiseAttendance
);

router.get("/attendance/monthly", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getMonthlyAttendance
);

// 👨‍🏫 Teachers
router.get("/teachers", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.getMyTeachers
);

// 📱 Device
router.post("/update-device", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  studentController.updateDeviceInfo
);

// 👨‍💼 Admin can view student details
router.get("/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacherOrInstitution, 
  studentController.getStudentById
);

module.exports = router;