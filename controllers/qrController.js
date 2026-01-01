const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const Teacher = require("../models/Teacher");

// Generate unique session ID
const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex");
};

// 📱 Generate QR Code for Class (Teacher)
exports.generateQR = async (req, res) => {
  try {
    const { subject, class: className, section, period } = req.body;
    const teacherId = req.user.id; // From auth middleware
    const institutionCode = req.user.institutionCode;

    if (!subject || !className) {
      return res.status(400).json({ 
        success: false, 
        message: "Subject and Class are required" 
      });
    }

    // Get teacher details
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    // Generate unique session ID
    const sessionId = generateSessionId();
    
    // Create QR payload
    const qrPayload = {
      sessionId,
      teacherId,
      teacherName: teacher.name,
      subject,
      class: className,
      section: section || "",
      period: period || 1,
      institutionCode,
      timestamp: Date.now()
    };

    // Create JWT token (valid for 5 minutes)
    const qrToken = jwt.sign(
      qrPayload,
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    // Store session info (optional - for tracking)
    const sessionData = {
      sessionId,
      teacherId,
      subject,
      class: className,
      section,
      period,
      institutionCode,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };

    res.status(200).json({
      success: true,
      message: "QR Code generated successfully",
      data: {
        qrToken,
        sessionId,
        expiresIn: "5 minutes",
        classInfo: {
          subject,
          class: className,
          section,
          period,
          teacher: teacher.name
        }
      }
    });

  } catch (error) {
    console.error("QR Generation Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate QR code",
      error: error.message 
    });
  }
};

// 🔄 Refresh QR Code
exports.refreshQR = async (req, res) => {
  try {
    const { oldSessionId } = req.body;
    
    // Invalidate old session (mark as expired in your logic)
    // Generate new QR
    const qrData = await this.generateQR(req, res);
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to refresh QR" 
    });
  }
};

// 📊 Get Active QR Sessions
exports.getActiveSessions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // This would typically come from Redis or a temporary store
    // For now, return mock/placeholder
    res.json({
      success: true,
      message: "Active sessions fetched",
      data: {
        activeSessions: [],
        total: 0
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch sessions" 
    });
  }
};

// 🎓 Scan QR Code (Student Attendance)
exports.scanQR = async (req, res) => {
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
    const decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    
    // Check if session is expired
    if (Date.now() > decoded.timestamp + (5 * 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: "QR code has expired"
      });
    }

    // Check if attendance already marked
    const existingAttendance = await Attendance.findOne({
      sessionId: decoded.sessionId,
      studentId: studentId
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for this session"
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      sessionId: decoded.sessionId,
      teacherId: decoded.teacherId,
      studentId: studentId,
      subject: decoded.subject,
      class: decoded.class,
      section: decoded.section,
      period: decoded.period,
      institutionCode: decoded.institutionCode,
      markedAt: new Date(),
      status: 'present'
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        attendanceId: attendance._id,
        subject: decoded.subject,
        class: decoded.class,
        teacher: decoded.teacherName,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error("Scan QR Error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code"
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: "QR code has expired"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to scan QR code",
      error: error.message
    });
  }
};

// 👨‍💼 Get Institution Sessions (Admin/Institution)
exports.getInstitutionSessions = async (req, res) => {
  try {
    const institutionCode = req.user.institutionCode;
    
    // Get all sessions for the institution
    // This would query your database for sessions
    // For now, return placeholder
    res.json({
      success: true,
      message: "Institution sessions fetched",
      data: {
        sessions: [],
        total: 0,
        institution: institutionCode
      }
    });
    
  } catch (error) {
    console.error("Get Institution Sessions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch institution sessions",
      error: error.message
    });
  }
};