const express = require("express");
const router = express.Router();
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Institution = require("../models/Institution");
const { protect, adminOnly } = require("../middleware/authMiddleware");

/**
 * 📊 Admin Dashboard Summary
 */
router.get("/dashboard", protect, adminOnly, async (req, res) => {
  const institutionCode = req.user.institutionCode;

  const teachers = await Teacher.countDocuments({ institutionCode });
  const students = await Student.countDocuments({ institutionCode });
  const attendance = await Attendance.countDocuments({ institutionCode });

  res.json({ teachers, students, attendance, institutionCode });
});

/**
 * 👨‍🏫 Get all teachers
 */
router.get("/teachers", protect, adminOnly, async (req, res) => {
  const teachers = await Teacher.find({
    institutionCode: req.user.institutionCode,
  });
  res.json(teachers);
});

/**
 * ➕ Add teacher
 */
router.post("/teacher", protect, adminOnly, async (req, res) => {
  const teacher = await Teacher.create({
    ...req.body,
    institutionCode: req.user.institutionCode,
  });
  res.json(teacher);
});

/**
 * 🎓 Get all students
 */
router.get("/students", protect, adminOnly, async (req, res) => {
  const students = await Student.find({
    institutionCode: req.user.institutionCode,
  });
  res.json(students);
});

/**
 * ➕ Add student
 */
router.post("/student", protect, adminOnly, async (req, res) => {
  const student = await Student.create({
    ...req.body,
    institutionCode: req.user.institutionCode,
  });
  res.json(student);
});

/**
 * 📋 Attendance Report
 */
router.get("/attendance", protect, adminOnly, async (req, res) => {
  const attendance = await Attendance.find({
    institutionCode: req.user.institutionCode,
  })
    .populate("studentId", "name rollNo")
    .populate("teacherId", "name teacherId")
    .sort({ createdAt: -1 });

  res.json(attendance);
});

module.exports = router;
