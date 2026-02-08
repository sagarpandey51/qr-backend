const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  // For Student Attendance
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
  },
  
  // For Teacher Attendance
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  
  // Attendance type (CRITICAL for teacher QR)
  attendanceType: {
    type: String,
    enum: ['student', 'teacher'],
    default: 'student',
    required: true
  },
  
  // Subject (for class attendance)
  subject: {
    type: String,
  },
  
  institutionCode: {
    type: String,
    required: true,
  },
  
  sessionId: {
    type: String,
    required: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
    default: 'present'
  },
  
  // Date (start of day)
  date: {
    type: Date,
    default: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    },
    required: true,
  },
  
  // Scan time
  scanTime: {
    type: Date,
    default: Date.now
  },
  
  // Teacher specific fields
  teacherCheckIn: {
    type: Date
  },
  
  teacherCheckOut: {
    type: Date
  },
  
  workHours: {
    type: Number,
    default: 0
  },
  
  markedBy: {
    type: String,
    default: 'system'
  },
  
  remarks: {
    type: String,
    default: ''
  },
  
  // Additional fields
  class: {
    type: String
  },
  
  section: {
    type: String
  },
  
  period: {
    type: Number,
    default: 1
  },
  
  lateMinutes: {
    type: Number,
    default: 0
  },
  
  rollNumber: {
    type: String
  },
  
  // Original fields
  location: {
    lat: Number,
    lng: Number,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Attendance", AttendanceSchema);