const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema({
  // Personal Information
  name: { 
    type: String, 
    required: [true, "Name is required"],
    trim: true 
  },
  teacherId: { 
    type: String, 
    required: [true, "Teacher ID is required"],
    unique: true,
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
  },
  password: { 
    type: String, 
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"]
  },
  phone: { 
    type: String,
    trim: true,
    match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"]
  },

  // Professional Information
  designation: { 
    type: String,
    default: "Teacher",
    enum: [
      "Teacher",
      "Professor",
      "Assistant Professor",
      "Associate Professor",
      "Head of Department",
      "Dean"
    ]
  },
  department: { 
    type: String,
    required: [true, "Department is required"],
    trim: true
  },
  subjects: [{ 
    type: String,
    trim: true 
  }],
  
  // Institution Information
  institutionCode: { 
    type: String, 
    required: [true, "Institution code is required"],
    trim: true,
    index: true
  },
  institutionName: { 
    type: String,
    trim: true 
  },

  // Profile Information
  profilePhoto: { 
    type: String,
    default: ""
  },
  gender: { 
    type: String,
    enum: ["Male", "Female", "Other", ""],
    default: ""
  },
  dateOfBirth: { 
    type: Date 
  },
  address: { 
    type: String,
    trim: true 
  },

  // Device & Security
  deviceId: { 
    type: String,
    trim: true 
  },
  fcmToken: { 
    type: String,
    trim: true 
  },
  lastLogin: { 
    type: Date 
  },
  loginHistory: [{
    device: String,
    ip: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // Status & Verification
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  verificationToken: { 
    type: String 
  },
  resetPasswordToken: { 
    type: String 
  },
  resetPasswordExpires: { 
    type: Date 
  },

  // Classes & Schedule
  assignedClasses: [{
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    subject: String,
    schedule: String,
    room: String
  }],

  // Metadata
  notes: { 
    type: String,
    trim: true 
  }
}, {
  timestamps: true,  // ✅ This automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual
TeacherSchema.virtual("fullName").get(function () {
  return this.name;
});

// Indexes
TeacherSchema.index({ department: 1 });
TeacherSchema.index({ createdAt: -1 });

// ✅ REMOVED: The problematic pre-save middleware
// TeacherSchema.pre("save", function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// Instance methods
TeacherSchema.methods.getActiveClasses = function () {
  return this.assignedClasses.filter(cls => cls.isActive !== false);
};

TeacherSchema.methods.getSubjectsString = function () {
  return this.subjects.join(", ");
};

TeacherSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,
    name: this.name,
    teacherId: this.teacherId,
    email: this.email,
    phone: this.phone,
    designation: this.designation,
    department: this.department,
    subjects: this.subjects,
    institutionCode: this.institutionCode,
    institutionName: this.institutionName,
    profilePhoto: this.profilePhoto,
    gender: this.gender,
    isActive: this.isActive,
    assignedClasses: this.assignedClasses,
    createdAt: this.createdAt
  };
};

// Static methods
TeacherSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

TeacherSchema.statics.findByTeacherId = function (teacherId) {
  return this.findOne({ teacherId });
};

TeacherSchema.statics.findActiveByInstitution = function (institutionCode) {
  return this.find({ institutionCode, isActive: true }).sort({ name: 1 });
};

TeacherSchema.statics.countByDepartment = function (department, institutionCode) {
  return this.countDocuments({ department, institutionCode, isActive: true });
};

module.exports = mongoose.model("Teacher", TeacherSchema);