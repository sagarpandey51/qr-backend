const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Institution = require("../models/Institution");

// Generate institution code helper
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
    const { name, email, password, type, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email and password are required" 
      });
    }

    // Check if institution already exists
    const existing = await Institution.findOne({ email });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: "Institution already registered with this email" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique institution code
    const institutionCode = generateInstitutionCode();

    // Create institution
    const institution = await Institution.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      uniqueCode: institutionCode,
      type: type || "college",
      address,
      subscription: "free"
    });

    res.status(201).json({
      success: true,
      message: "Institution registered successfully",
      data: {
        institutionId: institution._id,
        name: institution.name,
        email: institution.email,
        institutionCode,
        type: institution.type
      }
    });

  } catch (error) {
    console.error("Institution Registration Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during registration",
      error: error.message 
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
        message: "Invalid credentials" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, institution.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if institution is active
    if (!institution.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: "Institution account is deactivated" 
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
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        institution: {
          id: institution._id,
          name: institution.name,
          email: institution.email,
          institutionCode: institution.uniqueCode,
          type: institution.type,
          subscription: institution.subscription
        }
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
};

// 🎓 Student Login
exports.loginStudent = async (req, res) => {
  try {
    const { email, password, institutionCode } = req.body;

    if (!email || !password || !institutionCode) {
      return res.status(400).json({ 
        success: false, 
        message: "Email, password and institution code are required" 
      });
    }

    // Find student
    const student = await Student.findOne({ 
      email: email.toLowerCase(),
      institutionCode 
    });

    if (!student) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials or institution code" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if student is active
    if (!student.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: "Student account is deactivated" 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: student._id,
        email: student.email,
        institutionCode: student.institutionCode,
        type: 'student',
        rollNo: student.rollNo
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNo: student.rollNo,
          course: student.course,
          semester: student.semester,
          institutionCode: student.institutionCode
        }
      }
    });

  } catch (error) {
    console.error("Student Login Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
};

// 👨‍🏫 Teacher Login
exports.loginTeacher = async (req, res) => {
  try {
    const { email, password, institutionCode } = req.body;

    if (!email || !password || !institutionCode) {
      return res.status(400).json({ 
        success: false, 
        message: "Email, password and institution code are required" 
      });
    }

    // Find teacher
    const teacher = await Teacher.findOne({ 
      email: email.toLowerCase(),
      institutionCode 
    });

    if (!teacher) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials or institution code" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, teacher.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if teacher is active
    if (!teacher.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: "Teacher account is deactivated" 
      });
    }

    // Update last login
    teacher.lastLogin = new Date();
    await teacher.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: teacher._id,
        email: teacher.email,
        institutionCode: teacher.institutionCode,
        type: 'teacher',
        teacherId: teacher.teacherId
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          teacherId: teacher.teacherId,
          department: teacher.department,
          institutionCode: teacher.institutionCode,
          designation: teacher.designation
        }
      }
    });

  } catch (error) {
    console.error("Teacher Login Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
};

// 🔄 Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const userType = req.user.type;
    let userData;

    if (userType === 'institution') {
      const institution = await Institution.findById(req.user.id)
        .select('-password');
      userData = { ...institution.toObject(), type: 'institution' };
    } 
    else if (userType === 'teacher') {
      const teacher = await Teacher.findById(req.user.id)
        .select('-password -loginHistory -resetPasswordToken -resetPasswordExpires -verificationToken');
      userData = { ...teacher.toObject(), type: 'teacher' };
    }
    else if (userType === 'student') {
      const student = await Student.findById(req.user.id)
        .select('-password -deviceId -fcmToken');
      userData = { ...student.toObject(), type: 'student' };
    }

    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "User data fetched",
      data: userData
    });

  } catch (error) {
    console.error("Get User Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};
// 🔐 Change Password (Protected)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    // Find user based on type
    let user;
    if (userType === 'institution') {
      user = await Institution.findById(userId);
    } else if (userType === 'teacher') {
      user = await Teacher.findById(userId);
    } else if (userType === 'student') {
      user = await Student.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error changing password"
    });
  }
};

// 📧 Forgot Password (Public)
exports.forgotPassword = async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        message: "Email and user type are required"
      });
    }

    // Find user based on type
    let user;
    if (userType === 'institution') {
      user = await Institution.findOne({ email: email.toLowerCase() });
    } else if (userType === 'teacher') {
      user = await Teacher.findOne({ email: email.toLowerCase() });
    } else if (userType === 'student') {
      user = await Student.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      // For security, don't reveal if user exists or not
      return res.status(200).json({
        success: true,
        message: "If your email exists in our system, you will receive a reset link"
      });
    }

    // Generate reset token (simple version - in production use crypto)
    const resetToken = jwt.sign(
      { id: user._id, type: userType },
      process.env.JWT_SECRET + user.password,
      { expiresIn: '1h' }
    );

    // In a real app, you would:
    // 1. Save the token to the user document
    // 2. Send an email with reset link
    // 3. Create a proper reset URL

    console.log(`Reset token for ${email}:`, resetToken); // For testing

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to email",
      // In development, you might return the token for testing
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing forgot password"
    });
  }
};

// 🔑 Reset Password (Public)
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, userType } = req.body;

    if (!token || !newPassword || !userType) {
      return res.status(400).json({
        success: false,
        message: "Token, new password and user type are required"
      });
    }

    // Find user first to get current password for token verification
    let user;
    let userId;
    
    try {
      // Decode token to get user ID
      const decoded = jwt.decode(token);
      userId = decoded?.id;
      
      if (!userId) {
        throw new Error("Invalid token");
      }

      if (userType === 'institution') {
        user = await Institution.findById(userId);
      } else if (userType === 'teacher') {
        user = await Teacher.findById(userId);
      } else if (userType === 'student') {
        user = await Student.findById(userId);
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify token with user's current password as secret
    try {
      jwt.verify(token, process.env.JWT_SECRET + user.password);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error resetting password"
    });
  }
};

// 📱 Update Device Token (Protected)
exports.updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    // Update based on user type
    if (userType === 'teacher') {
      await Teacher.findByIdAndUpdate(userId, { fcmToken });
    } else if (userType === 'student') {
      await Student.findByIdAndUpdate(userId, { fcmToken });
    }
    // Institution might not need FCM token

    res.status(200).json({
      success: true,
      message: "FCM token updated successfully"
    });

  } catch (error) {
    console.error("Update FCM Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating FCM token"
    });
  }
};