// routes/attendance.js - CLEAN VERSION
const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance"); // ✅ CORRECT - Import the model
const authMiddleware = require("../middleware/authMiddleware");

// Test route
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Attendance routes are working",
    teacherQRTest: "POST /api/qr/test/teacher"
  });
});

// Student marks attendance (when student scans teacher's QR)
router.post("/mark", 
  authMiddleware.authenticate, 
  authMiddleware.isStudent, 
  async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Student attendance marked (placeholder)",
        note: "Use /api/qr/scan for actual student QR scanning"
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get class attendance (teacher view)
router.get("/class", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  async (req, res) => {
    try {
      const { date, subject, className } = req.query;
      
      const attendance = await Attendance.find({
        teacherId: req.user.id,
        ...(date && { date: new Date(date) }),
        ...(subject && { subject }),
        ...(className && { className })
      })
      .populate("studentId", "name rollNo")
      .sort({ scanTime: -1 });
      
      res.json({
        success: true,
        data: attendance,
        count: attendance.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get teacher's own attendance
router.get("/teacher/my-attendance", 
  authMiddleware.authenticate, 
  authMiddleware.isTeacher, 
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let query = { 
        teacherId: req.user.id,
        attendanceType: "teacher" 
      };
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
      }
      
      const attendance = await Attendance.find(query)
        .sort({ date: -1, scanTime: -1 });
      
      res.json({
        success: true,
        data: attendance,
        count: attendance.length
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;