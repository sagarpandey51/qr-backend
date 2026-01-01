const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ ADDED: Public registration route for new teachers
router.post("/register", teacherController.registerTeacher);

// ✅ ADDED: Or use this if you prefer "join"
// router.post("/join", teacherController.registerTeacher);

// 👨‍🏫 Teacher Profile (Protected)
router.get("/profile", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getProfile
);

router.put("/update-profile", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.updateProfile
);

router.put("/change-password", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.changePassword
);

// 🏫 Classes Management
router.get("/classes", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getMyClasses
);

router.post("/add-class", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.addClass
);

router.put("/classes/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.updateClass
);

// 📚 Subjects
router.get("/subjects", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getMySubjects
);

// 👨‍🎓 Students Management
router.get("/my-students", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getMyStudents
);

router.get("/student/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getStudentDetails
);

// 📊 Attendance Reports
router.get("/attendance/summary", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getAttendanceSummary
);

router.get("/attendance/daily", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getDailyAttendance
);

router.get("/attendance/subject-report", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getSubjectReport
);

// 📅 Schedule/Timetable
router.get("/schedule", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.getSchedule
);

router.post("/schedule", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  teacherController.updateSchedule
);

// 👨‍💼 Admin can view teacher details
router.get("/:id", 
  authMiddleware.authenticate, 
  authMiddleware.isInstitution, 
  teacherController.getTeacherById
);

module.exports = router;