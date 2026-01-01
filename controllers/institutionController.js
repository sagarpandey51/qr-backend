const Institution = require("../models/Institution");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Attendance = require("../models/Attendance");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Helper function to generate institution code
const generateInstitutionCode = () => {
  const prefix = "INST-";
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + randomPart;
};

// 🏫 Institution Registration
exports.registerInstitution = async (req, res) => {
  try {
    const { name, email, password, type, address, phone } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Name, email and password are required" 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide a valid email address" 
      });
    }

    // Password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters long" 
      });
    }

    // Check if institution already exists
    const existing = await Institution.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: "An institution is already registered with this email" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique institution code
    let institutionCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    // Ensure unique institution code
    while (!isUnique && attempts < maxAttempts) {
      institutionCode = generateInstitutionCode();
      const existingCode = await Institution.findOne({ uniqueCode: institutionCode });
      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ 
        success: false,
        message: "Failed to generate unique institution code. Please try again." 
      });
    }

    // Create institution
    const institution = await Institution.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      uniqueCode: institutionCode,
      type: type || "school",
      contact: {
        phone: phone || ""
      },
      address: address || {},
      subscription: "free",
      maxTeachers: 5,
      maxStudents: 100,
      isActive: true,
      academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1)
    });

    // Generate JWT token for immediate login
    const token = jwt.sign(
      {
        id: institution._id,
        email: institution.email,
        institutionCode: institution.uniqueCode,
        type: 'institution'
      },
      process.env.JWT_SECRET || "your_jwt_secret_key",
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: "🎉 Institution registered successfully!",
      data: {
        token,
        institution: {
          id: institution._id,
          name: institution.name,
          email: institution.email,
          institutionCode: institution.uniqueCode,
          type: institution.type,
          subscription: institution.subscription,
          createdAt: institution.createdAt
        }
      }
    });

  } catch (error) {
    console.error("❌ Institution Registration Error:", error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        message: `${field === 'email' ? 'Email' : 'Institution code'} already exists` 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Internal server error. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🔐 Institution Login
exports.loginInstitution = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    // Find institution
    const institution = await Institution.findOne({ email: email.toLowerCase() });
    if (!institution) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, institution.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check if institution is active
    if (!institution.isActive) {
      return res.status(403).json({ 
        success: false,
        message: "Your institution account has been deactivated. Please contact support." 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: institution._id,
        email: institution.email,
        institutionCode: institution.uniqueCode,
        type: 'institution'
      },
      process.env.JWT_SECRET || "your_jwt_secret_key",
      { expiresIn: '30d' }
    );

    // Update last login
    institution.lastLogin = new Date();
    await institution.save();

    res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        token,
        institution: {
          id: institution._id,
          name: institution.name,
          email: institution.email,
          institutionCode: institution.uniqueCode,
          type: institution.type,
          subscription: institution.subscription,
          isActive: institution.isActive,
          createdAt: institution.createdAt
        }
      }
    });

  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error. Please try again later." 
    });
  }
};

// 👨‍💼 Get Institution Profile
exports.getInstitutionProfile = async (req, res) => {
  try {
    const institution = await Institution.findById(req.user.id)
      .select('-password -__v');

    if (!institution) {
      return res.status(404).json({ 
        success: false,
        message: "Institution not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: institution
    });

  } catch (error) {
    console.error("❌ Profile Fetch Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch institution profile" 
    });
  }
};

// 🔄 Update Institution Profile
exports.updateInstitutionProfile = async (req, res) => {
  try {
    const { name, address, phone, logo, academicYear } = req.body;
    
    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (address) updateData.address = address;
    if (phone) updateData.contact = { ...updateData.contact, phone };
    if (logo) updateData.logo = logo;
    if (academicYear) updateData.academicYear = academicYear;

    const institution = await Institution.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -__v');

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: institution
    });

  } catch (error) {
    console.error("❌ Update Error:", error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to update profile" 
    });
  }
};

// 📊 Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    
    // Get counts
    const [studentCount, teacherCount, todayAttendance] = await Promise.all([
      Student.countDocuments({ institutionCode, isActive: true }),
      Teacher.countDocuments({ institutionCode, isActive: true }),
      (async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return await Attendance.countDocuments({ 
          institutionCode, 
          date: { $gte: today } 
        });
      })()
    ]);
    
    // Get recent activities
    const recentActivities = await Attendance.find({ institutionCode })
      .populate('studentId', 'name rollNo')
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('subject status scanTime');
    
    // Calculate attendance percentage for today
    const totalPossible = studentCount;
    const attendancePercentage = totalPossible > 0 ? 
      Math.round((todayAttendance / totalPossible) * 100) : 0;
    
    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents: studentCount,
          totalTeachers: teacherCount,
          todayAttendance,
          attendancePercentage
        },
        recentActivities,
        institutionCode
      }
    });
    
  } catch (error) {
    console.error("❌ Dashboard Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch dashboard statistics" 
    });
  }
};

// 👥 Get All Students
exports.getAllStudents = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { page = 1, limit = 20, class: className, section, search } = req.query;
    
    let query = { institutionCode, isActive: true };
    
    if (className) query.class = className;
    if (section) query.section = section;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const students = await Student.find(query)
      .select('-password -__v')
      .sort({ class: 1, section: 1, rollNo: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Student.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Get Students Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch students" 
    });
  }
};

// 👥 Get All Teachers
exports.getAllTeachers = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { page = 1, limit = 20, search } = req.query;
    
    let query = { institutionCode, isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const teachers = await Teacher.find(query)
      .select('-password -__v')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Teacher.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        teachers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Get Teachers Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch teachers" 
    });
  }
};

// ➕ Add Student
exports.addStudent = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { 
      name, rollNo, email, class: className, section, 
      dateOfBirth, gender, parentName, parentPhone 
    } = req.body;
    
    if (!name || !rollNo || !email || !className) {
      return res.status(400).json({
        success: false,
        message: "Name, roll number, email and class are required"
      });
    }
    
    // Check if student already exists
    const existingStudent = await Student.findOne({ 
      institutionCode, 
      $or: [{ email }, { rollNo }] 
    });
    
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student with ${existingStudent.email === email ? 'email' : 'roll number'} already exists`
      });
    }
    
    // Generate default password (rollNo + last 4 digits of phone if available)
    const defaultPassword = parentPhone ? 
      rollNo + parentPhone.slice(-4) : 
      rollNo + "1234";
    
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Create student
    const student = await Student.create({
      name: name.trim(),
      rollNo: rollNo.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      class: className,
      section: section || "",
      dateOfBirth: dateOfBirth || null,
      gender: gender || "",
      parentName: parentName || "",
      parentPhone: parentPhone || "",
      institutionCode,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: "Student added successfully",
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNo: student.rollNo,
          email: student.email,
          class: student.class,
          section: student.section,
          institutionCode: student.institutionCode
        },
        loginDetails: {
          defaultPassword: defaultPassword,
          note: "Student should change password on first login"
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Add Student Error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Student with this email or roll number already exists"
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to add student"
    });
  }
};

// ➕ Add Teacher
exports.addTeacher = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { 
      name, email, employeeId, subjects, phone, 
      qualification, department 
    } = req.body;
    
    if (!name || !email || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "Name, email and employee ID are required"
      });
    }
    
    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ 
      institutionCode, 
      $or: [{ email }, { employeeId }] 
    });
    
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: `Teacher with ${existingTeacher.email === email ? 'email' : 'employee ID'} already exists`
      });
    }
    
    // Generate default password (employeeId + last 4 digits of phone if available)
    const defaultPassword = phone ? 
      employeeId + phone.slice(-4) : 
      employeeId + "1234";
    
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Create teacher
    const teacher = await Teacher.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      employeeId: employeeId.trim(),
      subjects: subjects || [],
      phone: phone || "",
      qualification: qualification || "",
      department: department || "",
      institutionCode,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: "Teacher added successfully",
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          employeeId: teacher.employeeId,
          email: teacher.email,
          subjects: teacher.subjects,
          department: teacher.department,
          institutionCode: teacher.institutionCode
        },
        loginDetails: {
          defaultPassword: defaultPassword,
          note: "Teacher should change password on first login"
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Add Teacher Error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Teacher with this email or employee ID already exists"
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to add teacher"
    });
  }
};

// 📊 Get Attendance Summary
exports.getAttendanceSummary = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { period = 'daily' } = req.query; // daily, weekly, monthly
    
    const now = new Date();
    let startDate;
    
    switch(period) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default: // daily
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }
    
    const attendanceData = await Attendance.find({
      institutionCode,
      date: { $gte: startDate }
    }).populate('studentId', 'name rollNo class');
    
    // Calculate summary
    const totalRecords = attendanceData.length;
    const presentCount = attendanceData.filter(a => a.status === 'present').length;
    const lateCount = attendanceData.filter(a => a.status === 'late').length;
    const uniqueStudents = [...new Set(attendanceData.map(a => a.studentId._id.toString()))].length;
    
    res.status(200).json({
      success: true,
      data: {
        period,
        totalRecords,
        uniqueStudents,
        presentCount,
        lateCount,
        absentCount: totalRecords - (presentCount + lateCount),
        attendancePercentage: totalRecords > 0 ? 
          Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0,
        periodStart: startDate,
        periodEnd: now
      }
    });
    
  } catch (error) {
    console.error("❌ Attendance Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance summary"
    });
  }
};

// 📅 Get Daily Report
exports.getDailyReport = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.find({
      institutionCode,
      date: { $gte: targetDate }
    })
    .populate('studentId', 'name rollNo class section')
    .populate('teacherId', 'name')
    .sort({ scanTime: 1 });
    
    // Group by class and subject
    const report = {};
    attendance.forEach(record => {
      const key = `${record.class}_${record.section}_${record.subject}`;
      if (!report[key]) {
        report[key] = {
          class: record.class,
          section: record.section,
          subject: record.subject,
          teacher: record.teacherId.name,
          totalStudents: 0,
          present: 0,
          late: 0,
          absent: 0
        };
      }
      report[key].totalStudents++;
      if (record.status === 'present') report[key].present++;
      if (record.status === 'late') report[key].late++;
    });
    
    // Calculate absent counts
    Object.values(report).forEach(item => {
      item.absent = item.totalStudents - (item.present + item.late);
    });
    
    res.status(200).json({
      success: true,
      data: {
        date: targetDate.toDateString(),
        report: Object.values(report),
        totalClasses: Object.keys(report).length,
        totalAttendance: attendance.length
      }
    });
    
  } catch (error) {
    console.error("❌ Daily Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate daily report"
    });
  }
};

// 📅 Get Monthly Report
exports.getMonthlyReport = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { year, month } = req.query;
    
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      institutionCode,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('studentId', 'name rollNo class')
    .sort({ date: 1 });
    
    // Group by date
    const dailyReport = {};
    attendance.forEach(record => {
      const dateStr = record.date.toDateString();
      if (!dailyReport[dateStr]) {
        dailyReport[dateStr] = {
          date: dateStr,
          totalAttendance: 0,
          present: 0,
          late: 0
        };
      }
      dailyReport[dateStr].totalAttendance++;
      if (record.status === 'present') dailyReport[dateStr].present++;
      if (record.status === 'late') dailyReport[dateStr].late++;
    });
    
    // Calculate monthly summary
    const totalDays = Object.keys(dailyReport).length;
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    
    res.status(200).json({
      success: true,
      data: {
        month: `${targetMonth}/${targetYear}`,
        totalDays,
        totalAttendance,
        presentCount,
        lateCount,
        absentCount: totalAttendance - (presentCount + lateCount),
        attendancePercentage: totalAttendance > 0 ? 
          Math.round(((presentCount + lateCount) / totalAttendance) * 100) : 0,
        dailyReport: Object.values(dailyReport)
      }
    });
    
  } catch (error) {
    console.error("❌ Monthly Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate monthly report"
    });
  }
};

// 📤 Bulk Upload Students
exports.bulkUploadStudents = async (req, res) => {
  try {
    // This would handle CSV/Excel file upload
    // For now, return placeholder
    res.status(200).json({
      success: true,
      message: "Bulk upload endpoint ready",
      note: "Implement CSV parsing and bulk insertion here"
    });
    
  } catch (error) {
    console.error("❌ Bulk Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk upload"
    });
  }
};

// 📤 Bulk Upload Teachers
exports.bulkUploadTeachers = async (req, res) => {
  try {
    // This would handle CSV/Excel file upload
    // For now, return placeholder
    res.status(200).json({
      success: true,
      message: "Bulk upload endpoint ready",
      note: "Implement CSV parsing and bulk insertion here"
    });
    
  } catch (error) {
    console.error("❌ Bulk Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk upload"
    });
  }
};

// 🔄 Update Student Status
exports.updateStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const institutionCode = req.user.institutionCode;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive field is required and must be boolean"
      });
    }
    
    const student = await Student.findOneAndUpdate(
      { _id: id, institutionCode },
      { isActive },
      { new: true }
    ).select('-password -__v');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Student ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: student
    });
    
  } catch (error) {
    console.error("❌ Update Student Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update student status"
    });
  }
};

// 🔄 Update Teacher Status
exports.updateTeacherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const institutionCode = req.user.institutionCode;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive field is required and must be boolean"
      });
    }
    
    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, institutionCode },
      { isActive },
      { new: true }
    ).select('-password -__v');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Teacher ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: teacher
    });
    
  } catch (error) {
    console.error("❌ Update Teacher Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update teacher status"
    });
  }
};

// ❌ Delete Student
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionCode = req.user.institutionCode;
    
    const student = await Student.findOneAndDelete({ _id: id, institutionCode });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Student deleted successfully"
    });
    
  } catch (error) {
    console.error("❌ Delete Student Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete student"
    });
  }
};

// ❌ Delete Teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionCode = req.user.institutionCode;
    
    const teacher = await Teacher.findOneAndDelete({ _id: id, institutionCode });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Teacher deleted successfully"
    });
    
  } catch (error) {
    console.error("❌ Delete Teacher Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete teacher"
    });
  }
};