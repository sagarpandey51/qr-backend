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
// 👨‍🏫 Generate Teacher Self-Attendance QR
exports.generateTeacherSelfQR = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const institutionCode = req.user.institutionCode;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(16).toString("hex");
    
    // Teacher QR payload
    const qrPayload = {
      sessionId,
      teacherId,
      teacherName: teacher.name,
      institutionCode,
      timestamp: Date.now(),
      type: "teacher_attendance",  // Important identifier
      purpose: "check_in"
    };

    // Create QR token (valid for 2 minutes)
    const qrToken = jwt.sign(
      qrPayload,
      process.env.JWT_SECRET,
      { expiresIn: "2m" }
    );

    res.status(200).json({
      success: true,
      message: "Teacher Attendance QR Generated",
      data: {
        qrToken,
        sessionId,
        expiresIn: "2 minutes",
        teacherInfo: {
          name: teacher.name,
          teacherId: teacher.teacherId,
          department: teacher.department
        }
      }
    });

  } catch (error) {
    console.error("Teacher QR Generation Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate teacher QR" 
    });
  }
};

// 🔄 Scan Teacher QR (MAIN FUNCTION)
exports.scanTeacherQR = async (req, res) => {
  try {
    console.log("📱 Teacher QR Scan Request");
    
    const { qrToken } = req.body;
    
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
      console.log("✅ QR Verified:", {
        teacherId: decoded.teacherId,
        teacherName: decoded.teacherName,
        type: decoded.type
      });
    } catch (jwtError) {
      console.log("❌ QR Invalid:", jwtError.message);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired QR code" 
      });
    }

    // Check if it's a teacher QR
    if (decoded.type !== "teacher_attendance") {
      return res.status(400).json({
        success: false,
        message: "This QR is not for teacher attendance"
      });
    }

    // Get teacher from database
    const teacher = await Teacher.findById(decoded.teacherId);
    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentTime = new Date();

    // Check if teacher already has attendance today
    const existingAttendance = await Attendance.findOne({ 
      teacherId: decoded.teacherId,
      date: { $gte: today },
      attendanceType: 'teacher'
    });

    console.log("📅 Today:", today.toDateString());
    console.log("⏰ Current:", currentTime.toLocaleTimeString());
    console.log("🔍 Existing:", existingAttendance ? "Found" : "Not found");

    let attendance;
    
    if (!existingAttendance) {
      // CHECK-IN
      console.log("✅ Creating check-in record");
      
      attendance = new Attendance({
        teacherId: decoded.teacherId,
        institutionCode: decoded.institutionCode || teacher.institutionCode,
        attendanceType: 'teacher',
        teacherCheckIn: currentTime,
        status: 'present',
        date: today,
        scanTime: currentTime,
        sessionId: decoded.sessionId,
        markedBy: req.user?.id || 'qr_scanner',
        remarks: `Checked in at ${currentTime.toLocaleTimeString()}`
      });

      await attendance.save();
      console.log("💾 Saved attendance ID:", attendance._id);

      return res.status(200).json({
        success: true,
        message: "✅ Teacher check-in successful!",
        data: {
          teacherName: teacher.name,
          checkInTime: currentTime.toLocaleTimeString(),
          date: today.toDateString(),
          attendanceId: attendance._id,
          action: 'check_in'
        }
      });

    } else if (existingAttendance && !existingAttendance.teacherCheckOut) {
      // CHECK-OUT
      console.log("✅ Processing check-out");
      
      existingAttendance.teacherCheckOut = currentTime;
      existingAttendance.scanTime = currentTime;
      existingAttendance.remarks = `Checked out at ${currentTime.toLocaleTimeString()}`;
      
      // Calculate work hours
      if (existingAttendance.teacherCheckIn) {
        const workHours = (currentTime - existingAttendance.teacherCheckIn) / (1000 * 60 * 60);
        existingAttendance.workHours = parseFloat(workHours.toFixed(2));
        existingAttendance.remarks += ` | Worked: ${existingAttendance.workHours} hours`;
      }
      
      await existingAttendance.save();
      console.log("💾 Updated attendance ID:", existingAttendance._id);

      return res.status(200).json({
        success: false,  // Changed to false for testing
        message: "✅ Teacher check-out successful!",
        data: {
          teacherName: teacher.name,
          checkInTime: existingAttendance.teacherCheckIn.toLocaleTimeString(),
          checkOutTime: currentTime.toLocaleTimeString(),
          workHours: existingAttendance.workHours,
          date: today.toDateString(),
          attendanceId: existingAttendance._id,
          action: 'check_out'
        }
      });

    } else {
      console.log("⚠️ Already checked in and out");
      return res.status(400).json({
        success: false,
        message: "Attendance already completed for today"
      });
    }

  } catch (error) {
    console.error("🔥 Teacher QR Scan Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process QR scan",
      error: error.message
    });
  }
};

// 🧪 Test Teacher Scan (No QR needed)
exports.testTeacherScan = async (req, res) => {
  try {
    const { teacherId } = req.body;
    
    console.log("🧪 Test Teacher Scan - Teacher ID:", teacherId);
    
    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: "Teacher ID is required"
      });
    }
    
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentTime = new Date();
    
    console.log("👨‍🏫 Teacher:", teacher.name);
    console.log("📅 Date:", today.toDateString());
    console.log("⏰ Time:", currentTime.toLocaleTimeString());
    
    // Create test attendance
    const attendance = new Attendance({
      teacherId: teacherId,
      institutionCode: teacher.institutionCode,
      attendanceType: 'teacher',
      teacherCheckIn: currentTime,
      status: 'present',
      date: today,
      scanTime: currentTime,
      sessionId: `test_${Date.now()}`,
      markedBy: 'test_user',
      remarks: "Test teacher attendance"
    });
    
    await attendance.save();
    
    console.log("💾 Saved test attendance ID:", attendance._id);
    
    res.status(200).json({
      success: true,
      message: "✅ TEST SUCCESS! Teacher attendance stored.",
      data: {
        attendanceId: attendance._id,
        teacherName: teacher.name,
        teacherId: teacher.teacherId,
        checkInTime: currentTime.toLocaleTimeString(),
        date: today.toDateString(),
        database: "Atlas",
        action: 'test_check_in'
      }
    });
    
  } catch (error) {
    console.error("🔥 Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: error.message
    });
  }
};
// 🔄 SCAN TEACHER QR (NEW FUNCTION - ADD THIS)
exports.scanTeacherAttendanceQR = async (req, res) => {
  try {
    console.log("📱 Teacher QR Scan Request:", req.body);
    
    const { qrToken } = req.body;
    
    if (!qrToken) {
      console.log("❌ No QR token provided");
      return res.status(400).json({
        success: false,
        message: "QR token is required"
      });
    }

    // Verify QR token
    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
      console.log("✅ QR Decoded:", decoded);
    } catch (jwtError) {
      console.log("❌ JWT Error:", jwtError.message);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired QR code" 
      });
    }

    // Check if QR is for teacher
    if (!decoded.teacherId) {
      console.log("❌ Not a teacher QR");
      return res.status(400).json({
        success: false,
        message: "This QR is not for teacher attendance"
      });
    }

    // Get teacher from database
    const teacher = await Teacher.findById(decoded.teacherId);
    if (!teacher) {
      console.log("❌ Teacher not found in DB");
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    console.log("👨‍🏫 Teacher found:", teacher.name);

    // Check today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log("📅 Today's date:", today);

    // Check if teacher already has attendance today
    const existingAttendance = await Attendance.findOne({ 
      teacherId: decoded.teacherId,
      date: { $gte: today }
    });

    const currentTime = new Date();
    
    if (!existingAttendance) {
      // First check-in of the day
      console.log("✅ First check-in today");
      
      const attendance = new Attendance({
        teacherId: decoded.teacherId,
        studentId: null, // Important: teacher attendance, not student
        subject: "Teacher Attendance",
        institutionCode: decoded.institutionCode || teacher.institutionCode,
        sessionId: decoded.sessionId || `teacher_${Date.now()}`,
        date: today,
        createdAt: currentTime,
        status: 'present',
        teacherCheckIn: currentTime,
        teacherStatus: 'present',
        remarks: `Checked in at ${currentTime.toLocaleTimeString()} via QR scan`
      });

      await attendance.save();
      console.log("💾 Attendance saved:", attendance._id);

      res.status(200).json({
        success: true,
        message: "✅ Teacher check-in successful!",
        data: {
          teacherName: teacher.name,
          teacherId: teacher.teacherId,
          checkInTime: currentTime.toLocaleTimeString(),
          date: today.toDateString(),
          attendanceId: attendance._id,
          status: 'present'
        }
      });

    } else if (existingAttendance && !existingAttendance.teacherCheckOut) {
      // Check-out
      console.log("✅ Processing check-out");
      
      existingAttendance.teacherCheckOut = currentTime;
      existingAttendance.remarks = `Checked out at ${currentTime.toLocaleTimeString()}`;
      
      // Calculate work hours
      if (existingAttendance.teacherCheckIn) {
        const workHours = (currentTime - existingAttendance.teacherCheckIn) / (1000 * 60 * 60);
        existingAttendance.workHours = workHours.toFixed(2);
        existingAttendance.remarks += ` | Worked: ${existingAttendance.workHours} hours`;
      }
      
      await existingAttendance.save();
      console.log("💾 Check-out saved");

      res.status(200).json({
        success: true,
        message: "✅ Teacher check-out successful!",
        data: {
          teacherName: teacher.name,
          checkInTime: existingAttendance.teacherCheckIn.toLocaleTimeString(),
          checkOutTime: currentTime.toLocaleTimeString(),
          workHours: existingAttendance.workHours,
          date: today.toDateString(),
          attendanceId: existingAttendance._id
        }
      });

    } else {
      console.log("⚠️ Already checked in and out today");
      res.status(400).json({
        success: false,
        message: "Attendance already completed for today"
      });
    }

  } catch (error) {
    console.error("🔥 Teacher QR Scan Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process QR scan",
      error: error.message
    });
  }
};

// 🔄 TEST SCAN ENDPOINT (Simple version - no QR verification)
exports.testTeacherScan = async (req, res) => {
  try {
    const { teacherId } = req.body;
    
    console.log("🧪 Test Scan Request - Teacher ID:", teacherId);
    
    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: "Teacher ID is required"
      });
    }
    
    // Get teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create attendance
    const attendance = new Attendance({
      teacherId: teacherId,
      institutionCode: teacher.institutionCode,
      subject: "Teacher Attendance",
      date: today,
      status: 'present',
      createdAt: new Date(),
      sessionId: `test_${Date.now()}`,
      remarks: "Test scan attendance"
    });
    
    await attendance.save();
    
    console.log("✅ Test attendance saved:", attendance._id);
    
    res.status(200).json({
      success: true,
      message: "✅ Test scan successful! Attendance stored.",
      data: {
        attendanceId: attendance._id,
        teacherName: teacher.name,
        time: new Date().toLocaleTimeString(),
        date: today.toDateString()
      }
    });
    
  } catch (error) {
    console.error("🔥 Test Scan Error:", error);
    res.status(500).json({
      success: false,
      message: "Test scan failed",
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