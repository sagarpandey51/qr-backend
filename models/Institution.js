const mongoose = require("mongoose");

const InstitutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Institution name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, "Password is required"]
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ["school", "college", "coaching", "university"],
    default: "college"
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: "India"
    }
  },
  contact: {
    phone: String,
    website: String
  },
  subscription: {
    type: String,
    enum: ["free", "basic", "premium", "enterprise"],
    default: "free"
  },
  subscriptionExpiry: Date,
  maxTeachers: {
    type: Number,
    default: 5
  },
  maxStudents: {
    type: Number,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  logo: String,
  academicYear: {
    type: String,
    default: "2024-2025"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Institution", InstitutionSchema);