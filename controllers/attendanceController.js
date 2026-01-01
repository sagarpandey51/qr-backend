const jwt = require("jsonwebtoken");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// 🎓 Mark Attendance (Student scans QR)
exports.markAttendance = async (req, res) => {
  try {
    const { qrToken } = req.body;
    const studentId = req.user.id; // From auth middleware

    if (!qrToken) {
      return res.status(400).json({ 
        success: false, 
        message: "QR token is required" 
      });
    }

    // Verify QR token
    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        message: "QR code expired or invalid. Please ask teacher for a new one." 
      });
    }

    // Check if session is still valid (within 5 minutes)
    const currentTime = Date.now();
    const qrTime = decoded.timestamp;
    const timeDifference = (currentTime - qrTime) / 1000 / 60; // in minutes

    if (timeDifference > 5) {
      return res.status(401).json({ 
        success: false, 
        message: "QR code has expired. Please ask teacher for a new one." 
      });
    }

    // Check if attendance already marked for this session
    const existingAttendance = await Attendance.findOne({ 
      studentId, 
      sessionId: decoded.sessionId 
    });

    if (existingAttendance) {
      return res.status(400).json({ 
        success: false, 
        message: "Attendance already marked for this class" 
      });
    }

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }

    // Get teacher details
    const teacher = await Teacher.findById(decoded.teacherId);
    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    // Calculate if student is late
    const scanTime = new Date();
    const isLate = timeDifference > 1; // More than 1 minute = late
    const lateMinutes = isLate ? Math.floor(timeDifference) : 0;

    // Create attendance record
    const attendance = new Attendance({
      studentId,
      rollNumber: student.rollNo,
      teacherId: decoded.teacherId,
      institutionCode: decoded.institutionCode,
      class: decoded.class,
      section: decoded.section || student.section || "",
      subject: decoded.subject,
      period: decoded.period || 1,
      sessionId: decoded.sessionId,
      status: isLate ? 'late' : 'present',
      lateMinutes,
      date: new Date(),
      scanTime,
      remarks: isLate ? `Late by ${lateMinutes} minutes` : "On time"
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: isLate ? `Attendance marked (Late by ${lateMinutes} minutes)` : "Attendance marked successfully",
      data: {
        attendanceId: attendance._id,
        studentName: student.name,
        rollNo: student.rollNo,
        subject: decoded.subject,
        class: decoded.class,
        teacher: teacher.name,
        status: isLate ? 'late' : 'present',
        scanTime: scanTime.toLocaleTimeString(),
        lateMinutes
      }
    });

  } catch (error) {
    console.error("Attendance Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to mark attendance",
      error: error.message 
    });
  }
};

// 📅 Get Today's Attendance (Student)
exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({ 
      studentId, 
      date: { $gte: today } 
    })
    .populate('teacherId', 'name')
    .sort({ scanTime: -1 });

    res.status(200).json({
      success: true,
      message: "Attendance records fetched",
      data: {
        attendance,
        totalClasses: attendance.length,
        presentCount: attendance.filter(a => a.status === 'present').length,
        lateCount: attendance.filter(a => a.status === 'late').length
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch attendance" 
    });
  }
};

// 👨‍🏫 Get Class Attendance (Teacher)
exports.getClassAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { date, subject, class: className } = req.query;
    
    let query = { teacherId };
    
    if (date) {
      const filterDate = new Date(date);
      filterDate.setHours(0, 0, 0, 0);
      query.date = filterDate;
    }
    
    if (subject) query.subject = subject;
    if (className) query.class = className;

    const attendance = await Attendance.find(query)
      .populate('studentId', 'name rollNo')
      .sort({ scanTime: 1 });

    // Calculate statistics
    const totalStudents = [...new Set(attendance.map(a => a.studentId.toString()))].length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = totalStudents - (presentCount + lateCount);

    res.status(200).json({
      success: true,
      message: "Class attendance fetched",
      data: {
        attendance,
        statistics: {
          totalStudents,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          attendancePercentage: totalStudents > 0 ? 
            Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0
        }
      }
    });

  } catch (error) {
    console.error("Class Attendance Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch class attendance" 
    });
  }
};

// 📊 Get Attendance Report (Student)
exports.getAttendanceReport = async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    const filterStudentId = studentId || req.user.id;
    
    let query = { studentId: filterStudentId };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const attendance = await Attendance.find(query)
      .populate('teacherId', 'name')
      .sort({ date: -1, scanTime: -1 });

    // Calculate subject-wise attendance
    const subjectStats = {};
    attendance.forEach(record => {
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
      message: "Attendance report generated",
      data: {
        totalRecords: attendance.length,
        attendance,
        subjectStats,
        summary: {
          totalDays: [...new Set(attendance.map(a => a.date.toDateString()))].length,
          presentDays: attendance.filter(a => a.status === 'present').length,
          lateDays: attendance.filter(a => a.status === 'late').length
        }
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate report" 
    });
  }
};

// 📊 Get Subject Report (Teacher)
exports.getSubjectReport = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { subject, month, year } = req.query;
    
    let query = { teacherId };
    if (subject) query.subject = subject;
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('studentId', 'name rollNo')
      .sort({ date: 1 });

    // Group by student and calculate stats
    const studentStats = {};
    attendance.forEach(record => {
      const studentId = record.studentId._id.toString();
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          student: record.studentId.name,
          rollNo: record.studentId.rollNo,
          total: 0,
          present: 0,
          late: 0,
          attendancePercentage: 0
        };
      }
      studentStats[studentId].total++;
      if (record.status === 'present') studentStats[studentId].present++;
      if (record.status === 'late') studentStats[studentId].late++;
    });

    // Calculate percentages
    Object.values(studentStats).forEach(stat => {
      stat.attendancePercentage = stat.total > 0 ? 
        Math.round(((stat.present + stat.late) / stat.total) * 100) : 0;
    });

    res.status(200).json({
      success: true,
      message: "Subject report generated",
      data: {
        totalClasses: [...new Set(attendance.map(a => a.date.toDateString()))].length,
        totalStudents: Object.keys(studentStats).length,
        studentStats: Object.values(studentStats),
        overallAttendance: attendance.length > 0 ? 
          Math.round((attendance.filter(a => a.status !== 'absent').length / attendance.length) * 100) : 0
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

// 📅 Get Daily Summary (Teacher)
exports.getDailySummary = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { date } = req.query;
    
    const filterDate = date ? new Date(date) : new Date();
    filterDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({
      teacherId,
      date: { $gte: filterDate }
    })
    .populate('studentId', 'name rollNo')
    .sort({ period: 1, scanTime: 1 });

    // Group by subject and period
    const summary = {};
    attendance.forEach(record => {
      const key = `${record.subject}_${record.period}`;
      if (!summary[key]) {
        summary[key] = {
          subject: record.subject,
          period: record.period,
          class: record.class,
          totalStudents: 0,
          present: 0,
          late: 0,
          absent: 0
        };
      }
      summary[key].totalStudents++;
      if (record.status === 'present') summary[key].present++;
      if (record.status === 'late') summary[key].late++;
    });

    // Calculate absent counts
    Object.values(summary).forEach(item => {
      item.absent = item.totalStudents - (item.present + item.late);
    });

    res.status(200).json({
      success: true,
      message: "Daily summary fetched",
      data: {
        date: filterDate.toDateString(),
        summary: Object.values(summary),
        totalClasses: Object.keys(summary).length,
        overallAttendance: attendance.length > 0 ? 
          Math.round((attendance.filter(a => a.status !== 'absent').length / attendance.length) * 100) : 0
      }
    });

  } catch (error) {
    console.error("Daily Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch daily summary"
    });
  }
};

// 🏫 Get Institution Report (Admin)
exports.getInstitutionReport = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { startDate, endDate } = req.query;
    
    let query = { institutionCode };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const attendance = await Attendance.find(query)
      .populate('teacherId', 'name')
      .populate('studentId', 'name rollNo class section')
      .sort({ date: -1 });

    // Calculate institution-wide statistics
    const totalClasses = [...new Set(attendance.map(a => `${a.subject}_${a.date.toDateString()}_${a.period}`))].length;
    const totalStudents = [...new Set(attendance.map(a => a.studentId._id.toString()))].length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    
    res.status(200).json({
      success: true,
      message: "Institution report generated",
      data: {
        totalRecords: attendance.length,
        totalClasses,
        totalStudents,
        overallAttendance: attendance.length > 0 ? 
          Math.round(((presentCount + lateCount) / attendance.length) * 100) : 0,
        statistics: {
          present: presentCount,
          late: lateCount,
          absent: attendance.length - (presentCount + lateCount)
        },
        recentAttendance: attendance.slice(0, 50) // Last 50 records
      }
    });

  } catch (error) {
    console.error("Institution Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate institution report"
    });
  }
};

// 👥 Get Class-wise Report (Admin)
exports.getClassWiseReport = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { class: className, section, month, year } = req.query;
    
    let query = { institutionCode };
    if (className) query.class = className;
    if (section) query.section = section;
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('studentId', 'name rollNo')
      .populate('teacherId', 'name')
      .sort({ class: 1, section: 1, date: -1 });

    // Group by class and section
    const classStats = {};
    attendance.forEach(record => {
      const key = `${record.class}_${record.section}`;
      if (!classStats[key]) {
        classStats[key] = {
          class: record.class,
          section: record.section,
          totalStudents: 0,
          totalClasses: 0,
          present: 0,
          late: 0,
          students: new Set()
        };
      }
      classStats[key].students.add(record.studentId._id.toString());
      classStats[key].totalClasses++;
      if (record.status === 'present') classStats[key].present++;
      if (record.status === 'late') classStats[key].late++;
    });

    // Calculate final statistics
    const result = Object.values(classStats).map(stat => {
      stat.totalStudents = stat.students.size;
      delete stat.students;
      stat.attendancePercentage = stat.totalClasses > 0 ? 
        Math.round(((stat.present + stat.late) / stat.totalClasses) * 100) : 0;
      return stat;
    });

    res.status(200).json({
      success: true,
      message: "Class-wise report generated",
      data: {
        classWiseStats: result,
        totalClasses: result.reduce((sum, stat) => sum + stat.totalClasses, 0),
        totalStudents: result.reduce((sum, stat) => sum + stat.totalStudents, 0)
      }
    });

  } catch (error) {
    console.error("Class-wise Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate class-wise report"
    });
  }
};

// 📤 Export Attendance Data (Admin)
exports.exportAttendance = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    const { format = 'json', startDate, endDate } = req.query;
    
    let query = { institutionCode };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const attendance = await Attendance.find(query)
      .populate('teacherId', 'name email')
      .populate('studentId', 'name rollNo class section')
      .sort({ date: -1, class: 1, section: 1 });

    if (format === 'csv') {
      // Simple CSV implementation
      const csvData = attendance.map(record => ({
        Date: record.date.toDateString(),
        'Student Name': record.studentId.name,
        'Roll No': record.studentId.rollNo,
        Class: record.studentId.class,
        Section: record.studentId.section,
        Subject: record.subject,
        Period: record.period,
        'Teacher Name': record.teacherId.name,
        Status: record.status,
        'Scan Time': record.scanTime.toLocaleTimeString(),
        'Late Minutes': record.lateMinutes || 0,
        Remarks: record.remarks || ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
      
      // Convert to CSV string
      const headers = Object.keys(csvData[0] || {}).join(',');
      const rows = csvData.map(row => Object.values(row).map(val => 
        `"${String(val).replace(/"/g, '""')}"`
      ).join(','));
      
      const csvString = [headers, ...rows].join('\n');
      return res.send(csvString);
    } else {
      // Default JSON format
      res.status(200).json({
        success: true,
        message: "Attendance data exported",
        data: attendance,
        exportInfo: {
          totalRecords: attendance.length,
          dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All dates',
          exportedAt: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export attendance data"
    });
  }
};