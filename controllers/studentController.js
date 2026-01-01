const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Teacher = require("../models/Teacher");
const bcrypt = require("bcryptjs");

// ✅ UPDATED: Student Registration Function to match your model
exports.registerStudent = async (req, res) => {
  try {
    const { 
      name,           // Changed from fullName to match model
      rollNo,         // Changed from studentId to match model
      admissionNo,    // Added to match model
      email, 
      phone, 
      course,         // Changed from department to match model
      branch,         // Added to match model
      semester, 
      section,
      batch,
      parentPhone,
      password,
      institutionCode, // Required by model
      subjects        // Optional array
    } = req.body;

    // Validation - using model field names
    if (!name || !rollNo || !email || !course || !semester || !password || !institutionCode) {
      return res.status(400).json({ 
        success: false,
        error: "Please provide all required fields: name, rollNo, email, course, semester, password, institutionCode" 
      });
    }

    // Check if student already exists - using model field names
    const existingStudent = await Student.findOne({
      $or: [{ email }, { rollNo }, { admissionNo }].filter(condition => {
        const value = Object.values(condition)[0];
        return value !== undefined && value !== null && value !== '';
      })
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: "Student already registered with this email, roll number, or admission number"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new student - using model field names
    const student = new Student({
      name,
      rollNo,
      admissionNo: admissionNo || undefined, // Only set if provided
      email,
      phone: phone || "",
      course,
      branch: branch || "",
      semester,
      section: section || "",
      batch: batch || "",
      subjects: subjects || [],
      parentPhone: parentPhone || "",
      password: hashedPassword,
      isActive: true,
      institutionCode
    });

    await student.save();

    // Don't send password in response
    const studentResponse = student.toObject();
    delete studentResponse.password;
    delete studentResponse.deviceId;
    delete studentResponse.fcmToken;

    res.status(201).json({
      success: true,
      message: "Student registered successfully",
      data: studentResponse
    });

  } catch (error) {
    console.error("Student registration error:", error);
    
    // Better error handling
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        error: "Validation failed",
        details: messages 
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: "Registration failed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// Get student profile - UPDATED to use correct field names
exports.getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .select('-password -deviceId -fcmToken');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    // Get attendance summary - using student._id instead of studentId
    const totalAttendance = await Attendance.countDocuments({ studentId: req.user.id });
    const presentCount = await Attendance.countDocuments({ 
      studentId: req.user.id, 
      status: 'present' 
    });
    
    const attendancePercentage = totalAttendance > 0 ? 
      Math.round((presentCount / totalAttendance) * 100) : 0;
    
    res.status(200).json({
      success: true,
      data: {
        ...student.toObject(),
        attendanceStats: {
          totalClasses: totalAttendance,
          present: presentCount,
          percentage: attendancePercentage
        }
      }
    });
    
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch profile" 
    });
  }
};

// Update student profile - UPDATED fields
exports.updateProfile = async (req, res) => {
  try {
    const { 
      name, 
      phone, 
      parentPhone, 
      branch, 
      section, 
      batch,
      subjects 
    } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (parentPhone) updateData.parentPhone = parentPhone;
    if (branch) updateData.branch = branch;
    if (section) updateData.section = section;
    if (batch) updateData.batch = batch;
    if (subjects) updateData.subjects = subjects;
    
    const student = await Student.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -deviceId -fcmToken');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: student
    });
    
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update profile" 
    });
  }
};

// Change password - UPDATED
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }
    
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    student.password = hashedPassword;
    await student.save();
    
    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
    
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to change password" 
    });
  }
};

// Get timetable - UPDATED to use course/branch instead of class
exports.getTimetable = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .select('course branch section institutionCode');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    // This is a placeholder - you would typically fetch from a Timetable model
    const mockTimetable = [
      { day: "Monday", period1: "Mathematics", period2: "Science", period3: "English", period4: "History" },
      { day: "Tuesday", period1: "Science", period2: "Mathematics", period3: "Geography", period4: "Physical Education" },
      { day: "Wednesday", period1: "English", period2: "History", period3: "Mathematics", period4: "Science" },
      { day: "Thursday", period1: "Geography", period2: "English", period3: "Science", period4: "Mathematics" },
      { day: "Friday", period1: "History", period2: "Geography", period3: "Physical Education", period4: "English" }
    ];
    
    res.status(200).json({
      success: true,
      data: {
        course: student.course,
        branch: student.branch,
        section: student.section,
        timetable: mockTimetable
      }
    });
    
  } catch (error) {
    console.error("Timetable Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch timetable" 
    });
  }
};

// Get subjects - UPDATED to use student's actual subjects
exports.getSubjects = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .select('subjects institutionCode');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    // Use student's actual subjects or default
    const subjects = student.subjects && student.subjects.length > 0 
      ? student.subjects 
      : ["Mathematics", "Science", "English", "History", "Geography", "Physical Education"];
    
    // Get attendance for each subject
    const subjectStats = await Promise.all(
      subjects.map(async (subject) => {
        const total = await Attendance.countDocuments({
          studentId: req.user.id,
          subject: subject
        });
        
        const present = await Attendance.countDocuments({
          studentId: req.user.id,
          subject: subject,
          status: 'present'
        });
        
        return {
          subject,
          totalClasses: total,
          presentClasses: present,
          attendancePercentage: total > 0 ? Math.round((present / total) * 100) : 0
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        subjects: subjectStats
      }
    });
    
  } catch (error) {
    console.error("Subjects Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch subjects" 
    });
  }
};

// Get attendance overview - NO CHANGES NEEDED
exports.getAttendanceOverview = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [totalAttendance, presentCount, monthlyAttendance, monthlyPresent] = await Promise.all([
      Attendance.countDocuments({ studentId: req.user.id }),
      Attendance.countDocuments({ studentId: req.user.id, status: 'present' }),
      Attendance.countDocuments({ 
        studentId: req.user.id,
        date: { $gte: startOfMonth }
      }),
      Attendance.countDocuments({ 
        studentId: req.user.id,
        status: 'present',
        date: { $gte: startOfMonth }
      })
    ]);
    
    const overallPercentage = totalAttendance > 0 ? 
      Math.round((presentCount / totalAttendance) * 100) : 0;
    
    const monthlyPercentage = monthlyAttendance > 0 ? 
      Math.round((monthlyPresent / monthlyAttendance) * 100) : 0;
    
    // Get today's attendance
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todaysAttendance = await Attendance.find({
      studentId: req.user.id,
      date: { $gte: startOfDay }
    }).populate('teacherId', 'name');
    
    res.status(200).json({
      success: true,
      data: {
        overall: {
          totalClasses: totalAttendance,
          present: presentCount,
          percentage: overallPercentage
        },
        monthly: {
          totalClasses: monthlyAttendance,
          present: monthlyPresent,
          percentage: monthlyPercentage
        },
        todaysClasses: todaysAttendance.map(att => ({
          subject: att.subject,
          teacher: att.teacherId?.name || 'Unknown',
          status: att.status,
          time: att.scanTime.toLocaleTimeString()
        }))
      }
    });
    
  } catch (error) {
    console.error("Attendance Overview Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch attendance overview" 
    });
  }
};

// Get subject-wise attendance - NO CHANGES NEEDED
exports.getSubjectWiseAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { date: { $gte: start, $lte: end } };
    }
    
    // Get all distinct subjects for this student
    const subjects = await Attendance.distinct('subject', {
      studentId: req.user.id,
      ...dateFilter
    });
    
    const subjectStats = await Promise.all(
      subjects.map(async (subject) => {
        const [total, present, late] = await Promise.all([
          Attendance.countDocuments({
            studentId: req.user.id,
            subject,
            ...dateFilter
          }),
          Attendance.countDocuments({
            studentId: req.user.id,
            subject,
            status: 'present',
            ...dateFilter
          }),
          Attendance.countDocuments({
            studentId: req.user.id,
            subject,
            status: 'late',
            ...dateFilter
          })
        ]);
        
        return {
          subject,
          totalClasses: total,
          present: present,
          late: late,
          absent: total - (present + late),
          percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        subjectStats,
        period: startDate && endDate ? `${startDate} to ${endDate}` : 'All time'
      }
    });
    
  } catch (error) {
    console.error("Subject-wise Attendance Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch subject-wise attendance" 
    });
  }
};

// Get monthly attendance - NO CHANGES NEEDED
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      studentId: req.user.id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    // Group by date
    const dailyStats = {};
    attendance.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          day: record.date.toLocaleDateString('en-US', { weekday: 'short' }),
          classes: []
        };
      }
      dailyStats[dateStr].classes.push({
        subject: record.subject,
        teacher: record.teacherId,
        status: record.status,
        time: record.scanTime.toLocaleTimeString(),
        lateMinutes: record.lateMinutes || 0
      });
    });
    
    // Calculate monthly summary
    const totalClasses = attendance.length;
    const presentClasses = attendance.filter(a => a.status === 'present').length;
    const lateClasses = attendance.filter(a => a.status === 'late').length;
    
    res.status(200).json({
      success: true,
      data: {
        month: `${targetMonth}/${targetYear}`,
        summary: {
          totalClasses,
          present: presentClasses,
          late: lateClasses,
          absent: totalClasses - (presentClasses + lateClasses),
          percentage: totalClasses > 0 ? 
            Math.round(((presentClasses + lateClasses) / totalClasses) * 100) : 0
        },
        dailyStats: Object.values(dailyStats)
      }
    });
    
  } catch (error) {
    console.error("Monthly Attendance Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch monthly attendance" 
    });
  }
};

// Get my teachers - UPDATED to use course instead of class
exports.getMyTeachers = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .select('course branch section institutionCode');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    // Find teachers who teach this student's course/branch
    const teachers = await Teacher.find({
      institutionCode: student.institutionCode,
      $or: [
        { courses: student.course },
        { branches: student.branch },
        { courses: 'All' }
      ]
    }).select('-password');
    
    // Get subjects taught by each teacher
    const teachersWithSubjects = teachers.map(teacher => ({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      employeeId: teacher.employeeId,
      subjects: teacher.subjects,
      department: teacher.department,
      profileImage: teacher.profileImage
    }));
    
    res.status(200).json({
      success: true,
      data: {
        teachers: teachersWithSubjects,
        course: student.course,
        branch: student.branch,
        section: student.section
      }
    });
    
  } catch (error) {
    console.error("Get Teachers Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teachers" 
    });
  }
};

// Update device information - NO CHANGES NEEDED
exports.updateDeviceInfo = async (req, res) => {
  try {
    const { deviceId, fcmToken } = req.body;
    
    const updateData = {};
    if (deviceId) updateData.deviceId = deviceId;
    if (fcmToken) updateData.fcmToken = fcmToken;
    
    const student = await Student.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    );
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Device information updated successfully"
    });
    
  } catch (error) {
    console.error("Update Device Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update device information" 
    });
  }
};

// Get student by ID (for admin/teacher) - UPDATED field names
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id)
      .select('-password -deviceId -fcmToken');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: "Student not found" 
      });
    }
    
    // Check if the requester has permission (same institution)
    if (req.user.institutionCode !== student.institutionCode) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // Get student's attendance summary
    const [totalAttendance, presentCount] = await Promise.all([
      Attendance.countDocuments({ studentId: id }),
      Attendance.countDocuments({ studentId: id, status: 'present' })
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        student,
        attendanceStats: {
          totalClasses: totalAttendance,
          present: presentCount,
          percentage: totalAttendance > 0 ? 
            Math.round((presentCount / totalAttendance) * 100) : 0
        }
      }
    });
    
  } catch (error) {
    console.error("Get Student by ID Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student details" 
    });
  }
};