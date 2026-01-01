const Teacher = require("../models/Teacher");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const bcrypt = require("bcryptjs");

// ✅ FIXED: Teacher Registration Function
exports.registerTeacher = async (req, res) => {
  try {
    console.log('📝 Teacher registration request received:', req.body);
    
    const { 
      name,
      teacherId, 
      email, 
      phone, 
      department, 
      designation, 
      subjects,
      password,
      institutionCode
    } = req.body;

    // Validation
    if (!name || !teacherId || !email || !department || !password || !institutionCode) {
      console.log('❌ Missing required fields:', { 
        hasName: !!name, 
        hasTeacherId: !!teacherId, 
        hasEmail: !!email, 
        hasDepartment: !!department, 
        hasPassword: !!password,
        hasInstitutionCode: !!institutionCode
      });
      return res.status(400).json({ 
        success: false,
        error: "Please provide all required fields: name, teacherId, email, department, institutionCode, password" 
      });
    }

    console.log('🔍 Checking for existing teacher...');
    
    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({
      $or: [{ email }, { teacherId }]
    });

    if (existingTeacher) {
      console.log('❌ Teacher already exists');
      return res.status(400).json({
        success: false,
        error: "Teacher already registered with this email or ID"
      });
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Clean phone number - remove all non-digits for validation
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    console.log('📝 Creating teacher object...');
    
    // Create new teacher - match model schema exactly
    const teacher = new Teacher({
      name,
      teacherId,
      email,
      phone: cleanPhone,
      department,
      designation: designation || "Teacher",
      subjects: subjects ? (Array.isArray(subjects) ? subjects : subjects.split(',').map(s => s.trim())) : [],
      password: hashedPassword,
      institutionCode,
      isActive: true,
      classes: []
    });

    console.log('💾 Saving teacher to database...');
    await teacher.save();
    console.log('✅ Teacher saved successfully:', teacher._id);

    // Don't send password in response
    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;
    delete teacherResponse.loginHistory;
    delete teacherResponse.resetPasswordToken;
    delete teacherResponse.resetPasswordExpires;

    res.status(201).json({
      success: true,
      message: "Teacher registered successfully",
      data: {
        teacher: teacherResponse
      }
    });

  } catch (error) {
    console.error("🔥 Teacher registration error:", error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      console.error('🔥 Validation errors:', messages);
      return res.status(400).json({ 
        success: false,
        error: "Validation failed",
        details: messages.join(', ')
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      console.error('🔥 Duplicate key error:', error.keyValue);
      return res.status(400).json({ 
        success: false,
        error: "Duplicate entry",
        details: `A teacher with this ${Object.keys(error.keyValue)[0]} already exists`
      });
    }
    
    // Pass error to Express error handler
 
  }
};
// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('-password -loginHistory -resetPasswordToken -resetPasswordExpires');
    
    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }
    
    // Get teaching stats
    const totalClasses = await Attendance.countDocuments({ teacherId: req.user.id });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayClasses = await Attendance.countDocuments({ 
      teacherId: req.user.id, 
      date: { $gte: today } 
    });
    
    res.status(200).json({
      success: true,
      data: {
        ...teacher.toObject(),
        teachingStats: {
          totalClasses,
          todayClasses
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch profile" 
    });
  }
};

// Update teacher profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, qualification, department, profileImage } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (qualification) updateData.qualification = qualification;
    if (department) updateData.department = department;
    if (profileImage) updateData.profileImage = profileImage;
    
    const teacher = await Teacher.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -loginHistory -resetPasswordToken -resetPasswordExpires');
    
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: teacher
    });
    
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update profile" 
    });
  }
};

// Change password
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
    
    const teacher = await Teacher.findById(req.user.id);
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    teacher.password = hashedPassword;
    await teacher.save();
    
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

// Get my classes
exports.getMyClasses = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('classes institutionCode');
    
    // Get unique classes from teacher's assigned classes
    const uniqueClasses = [...new Set(teacher.classes)];
    
    // Get attendance stats for each class
    const classStats = await Promise.all(
      uniqueClasses.map(async (className) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [todayAttendance, totalAttendance] = await Promise.all([
          Attendance.countDocuments({
            teacherId: req.user.id,
            class: className,
            date: { $gte: today }
          }),
          Attendance.countDocuments({
            teacherId: req.user.id,
            class: className
          })
        ]);
        
        // Get students in this class
        const students = await Student.find({
          institutionCode: teacher.institutionCode,
          class: className,
          isActive: true
        }).select('name rollNo');
        
        return {
          className,
          totalStudents: students.length,
          todayAttendance,
          totalAttendance,
          students: students
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        classes: classStats
      }
    });
    
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch classes" 
    });
  }
};

// Add class
exports.addClass = async (req, res) => {
  try {
    const { className } = req.body;
    
    if (!className) {
      return res.status(400).json({
        success: false,
        message: "Class name is required"
      });
    }
    
    const teacher = await Teacher.findById(req.user.id);
    
    // Check if class already exists in teacher's classes
    if (teacher.classes.includes(className)) {
      return res.status(400).json({
        success: false,
        message: "Class already assigned to this teacher"
      });
    }
    
    // Add class to teacher's classes array
    teacher.classes.push(className);
    await teacher.save();
    
    res.status(200).json({
      success: true,
      message: `Class ${className} added successfully`,
      data: {
        classes: teacher.classes
      }
    });
    
  } catch (error) {
    console.error("Add Class Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to add class" 
    });
  }
};

// Update class
exports.updateClass = async (req, res) => {
  try {
    const { id: className } = req.params;
    const { action } = req.body; // 'add' or 'remove'
    
    const teacher = await Teacher.findById(req.user.id);
    
    if (action === 'remove') {
      // Remove class from teacher's classes
      teacher.classes = teacher.classes.filter(cls => cls !== className);
      await teacher.save();
      
      res.status(200).json({
        success: true,
        message: `Class ${className} removed successfully`,
        data: {
          classes: teacher.classes
        }
      });
    } else {
      // For update, just return current classes
      res.status(200).json({
        success: true,
        message: "Class list",
        data: {
          classes: teacher.classes
        }
      });
    }
    
  } catch (error) {
    console.error("Update Class Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update class" 
    });
  }
};

// Get my subjects
exports.getMySubjects = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('subjects institutionCode');
    
    // Get attendance stats for each subject
    const subjectStats = await Promise.all(
      teacher.subjects.map(async (subject) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [todayClasses, totalClasses, studentCount] = await Promise.all([
          Attendance.countDocuments({
            teacherId: req.user.id,
            subject: subject,
            date: { $gte: today }
          }),
          Attendance.countDocuments({
            teacherId: req.user.id,
            subject: subject
          }),
          // Count unique students for this subject
          Attendance.distinct('studentId', {
            teacherId: req.user.id,
            subject: subject
          }).then(ids => ids.length)
        ]);
        
        return {
          subject,
          totalClasses,
          todayClasses,
          studentCount
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
    console.error("Get Subjects Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch subjects" 
    });
  }
};

// Get my students
exports.getMyStudents = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('classes institutionCode');
    
    // Find students in teacher's classes
    const students = await Student.find({
      institutionCode: teacher.institutionCode,
      class: { $in: teacher.classes },
      isActive: true
    }).select('name rollNo class section email parentPhone');
    
    // Get attendance stats for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const [totalAttendance, presentCount] = await Promise.all([
          Attendance.countDocuments({
            studentId: student._id,
            teacherId: req.user.id
          }),
          Attendance.countDocuments({
            studentId: student._id,
            teacherId: req.user.id,
            status: 'present'
          })
        ]);
        
        return {
          ...student.toObject(),
          attendanceStats: {
            totalClasses: totalAttendance,
            present: presentCount,
            percentage: totalAttendance > 0 ? 
              Math.round((presentCount / totalAttendance) * 100) : 0
          }
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        students: studentsWithStats,
        totalStudents: students.length
      }
    });
    
  } catch (error) {
    console.error("Get Students Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch students" 
    });
  }
};

// Get student details
exports.getStudentDetails = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    
    // Get student
    const student = await Student.findById(studentId)
      .select('-password -deviceId -fcmToken');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    // Check if student is in teacher's classes
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher.classes.includes(student.class)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this student"
      });
    }
    
    // Get attendance records for this student with this teacher
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      teacherId: req.user.id
    }).sort({ date: -1 });
    
    // Calculate subject-wise attendance
    const subjectStats = {};
    attendanceRecords.forEach(record => {
      const subject = record.subject;
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, present: 0, late: 0 };
      }
      subjectStats[subject].total++;
      if (record.status === 'present') subjectStats[subject].present++;
      if (record.status === 'late') subjectStats[subject].late++;
    });
    
    res.status(200).json({
      success: true,
      data: {
        student,
        attendance: {
          totalClasses: attendanceRecords.length,
          records: attendanceRecords.slice(0, 20), // Last 20 records
          subjectStats: Object.entries(subjectStats).map(([subject, stats]) => ({
            subject,
            ...stats,
            percentage: stats.total > 0 ? 
              Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
          }))
        }
      }
    });
    
  } catch (error) {
    console.error("Get Student Details Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch student details" 
    });
  }
};

// Get attendance summary
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { class: className, subject, date } = req.query;
    
    let query = { teacherId: req.user.id };
    if (className) query.class = className;
    if (subject) query.subject = subject;
    if (date) {
      const filterDate = new Date(date);
      filterDate.setHours(0, 0, 0, 0);
      query.date = { $gte: filterDate };
    }
    
    const attendance = await Attendance.find(query)
      .populate('studentId', 'name rollNo');
    
    // Calculate summary
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const uniqueStudents = [...new Set(attendance.map(a => a.studentId._id.toString()))].length;
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalClasses: totalRecords,
          uniqueStudents,
          present: presentCount,
          late: lateCount,
          absent: totalRecords - (presentCount + lateCount),
          attendancePercentage: totalRecords > 0 ? 
            Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0
        },
        filter: {
          class: className || 'All',
          subject: subject || 'All',
          date: date || 'Today'
        }
      }
    });
    
  } catch (error) {
    console.error("Attendance Summary Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch attendance summary" 
    });
  }
};

// Get daily attendance
exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.find({
      teacherId: req.user.id,
      date: { $gte: targetDate }
    })
    .populate('studentId', 'name rollNo class section')
    .sort({ period: 1, scanTime: 1 });
    
    // Group by class and period
    const dailyReport = {};
    attendance.forEach(record => {
      const key = `${record.class}_${record.period}`;
      if (!dailyReport[key]) {
        dailyReport[key] = {
          class: record.class,
          period: record.period,
          subject: record.subject,
          totalStudents: 0,
          present: 0,
          late: 0,
          students: []
        };
      }
      dailyReport[key].totalStudents++;
      if (record.status === 'present') dailyReport[key].present++;
      if (record.status === 'late') dailyReport[key].late++;
      dailyReport[key].students.push({
        name: record.studentId.name,
        rollNo: record.studentId.rollNo,
        status: record.status,
        scanTime: record.scanTime.toLocaleTimeString(),
        lateMinutes: record.lateMinutes || 0
      });
    });
    
    // Calculate absent counts
    Object.values(dailyReport).forEach(item => {
      item.absent = item.totalStudents - (item.present + item.late);
    });
    
    res.status(200).json({
      success: true,
      data: {
        date: targetDate.toDateString(),
        report: Object.values(dailyReport),
        totalClasses: Object.keys(dailyReport).length,
        totalAttendance: attendance.length
      }
    });
    
  } catch (error) {
    console.error("Daily Attendance Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch daily attendance" 
    });
  }
};

// Get subject report
exports.getSubjectReport = async (req, res) => {
  try {
    const { subject, month, year } = req.query;
    
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required"
      });
    }
    
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      teacherId: req.user.id,
      subject: subject,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('studentId', 'name rollNo class section')
    .sort({ date: 1 });
    
    // Group by student
    const studentStats = {};
    attendance.forEach(record => {
      const studentId = record.studentId._id.toString();
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          student: record.studentId.name,
          rollNo: record.studentId.rollNo,
          class: record.studentId.class,
          section: record.studentId.section,
          total: 0,
          present: 0,
          late: 0
        };
      }
      studentStats[studentId].total++;
      if (record.status === 'present') studentStats[studentId].present++;
      if (record.status === 'late') studentStats[studentId].late++;
    });
    
    // Calculate percentages
    const report = Object.values(studentStats).map(stat => ({
      ...stat,
      absent: stat.total - (stat.present + stat.late),
      percentage: stat.total > 0 ? 
        Math.round(((stat.present + stat.late) / stat.total) * 100) : 0
    }));
    
    // Overall statistics
    const totalClasses = [...new Set(attendance.map(a => a.date.toDateString()))].length;
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    
    res.status(200).json({
      success: true,
      data: {
        subject,
        month: `${targetMonth}/${targetYear}`,
        overall: {
          totalClasses,
          totalAttendance,
          present: presentCount,
          late: lateCount,
          absent: totalAttendance - (presentCount + lateCount),
          attendancePercentage: totalAttendance > 0 ? 
            Math.round(((presentCount + lateCount) / totalAttendance) * 100) : 0
        },
        studentReport: report
      }
    });
    
  } catch (error) {
    console.error("Subject Report Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate subject report" 
    });
  }
};

// Get schedule
exports.getSchedule = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('schedule classes subjects');
    
    // If teacher has schedule, return it, otherwise create mock schedule
    let schedule = teacher.schedule;
    
    if (!schedule || schedule.length === 0) {
      // Create mock schedule based on teacher's classes and subjects
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      schedule = days.map(day => ({
        day,
        periods: Array.from({ length: 6 }, (_, i) => ({
          period: i + 1,
          class: teacher.classes[i % teacher.classes.length] || 'Class A',
          subject: teacher.subjects[i % teacher.subjects.length] || 'Subject',
          startTime: `${8 + i}:00`,
          endTime: `${8 + i + 1}:00`
        }))
      }));
    }
    
    res.status(200).json({
      success: true,
      data: {
        schedule,
        classes: teacher.classes,
        subjects: teacher.subjects
      }
    });
    
  } catch (error) {
    console.error("Get Schedule Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch schedule" 
    });
  }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
  try {
    const { schedule } = req.body;
    
    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({
        success: false,
        message: "Schedule data is required and must be an array"
      });
    }
    
    await Teacher.findByIdAndUpdate(
      req.user.id,
      { $set: { schedule } }
    );
    
    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: { schedule }
    });
    
  } catch (error) {
    console.error("Update Schedule Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update schedule" 
    });
  }
};

// Get teacher by ID (for admin)
exports.getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findById(id)
      .select('-password -loginHistory -resetPasswordToken -resetPasswordExpires');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    // Check if requester is from same institution
    if (req.user.institutionCode !== teacher.institutionCode) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }
    
    // Get teaching stats
    const [totalClasses, todayClasses] = await Promise.all([
      Attendance.countDocuments({ teacherId: id }),
      (async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return await Attendance.countDocuments({ 
          teacherId: id, 
          date: { $gte: today } 
        });
      })()
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        teacher,
        teachingStats: {
          totalClasses,
          todayClasses
        }
      }
    });
    
  } catch (error) {
    console.error("Get Teacher by ID Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch teacher details" 
    });
  }
};