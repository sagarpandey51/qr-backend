const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  // Personal Information
  name: {
    type: String,
    required: [true, "Student name is required"],
    trim: true
  },
  
  // Academic Information
  rollNo: {
    type: String,
    required: [true, "Roll number is required"],
    trim: true,
    uppercase: true
  },
  admissionNo: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  
  // Course Details
  course: {
    type: String,
    required: [true, "Course is required"],
    trim: true
  },
  branch: {
    type: String,
    trim: true
  },
  semester: {
    type: String,
    required: [true, "Semester is required"],
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  batch: {
    type: String,
    trim: true
  },
  
  // Subjects
  subjects: [{
    type: String,
    trim: true
  }],
  
  // Contact Information
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
  },
  parentPhone: {
    type: String,
    trim: true
  },
  
  // Authentication
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6
  },
  
  // Institution Reference
  institutionCode: {
    type: String,
    required: [true, "Institution code is required"],
    index: true
  },
  
  // Device Management (for mobile app)
  deviceId: {
    type: String,
    trim: true
  },
  fcmToken: {
    type: String,
    trim: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true  // Mongoose automatically adds createdAt and updatedAt
});

// ✅ REMOVE ALL MIDDLEWARE TEMPORARILY to test
// No pre-save hooks for now

// Indexes for faster queries
StudentSchema.index({ institutionCode: 1, rollNo: 1 }, { unique: true });
StudentSchema.index({ institutionCode: 1, email: 1 }, { unique: true });
StudentSchema.index({ institutionCode: 1, course: 1, semester: 1 });

module.exports = mongoose.model("Student", StudentSchema);