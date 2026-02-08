// checkQRAttendance.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkQRAttendance() {
  try {
    console.log('🔍 Checking QR Attendance Records...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // 1. Count all records
    const total = await db.collection('attendances').countDocuments();
    console.log('📊 Total attendance records:', total);
    
    if (total === 0) {
      console.log('❌ No attendance records found yet');
      console.log('💡 Need to generate QR and scan it first');
      return;
    }
    
    // 2. Count by type
    const teacherAtt = await db.collection('attendances').countDocuments({ attendanceType: 'teacher' });
    const studentAtt = await db.collection('attendances').countDocuments({ attendanceType: 'student' });
    
    console.log(`👨‍🏫 Teacher attendance: ${teacherAtt}`);
    console.log(`🎓 Student attendance: ${studentAtt}`);
    
    // 3. Show latest records
    console.log('\n📝 LATEST RECORDS:');
    console.log('─'.repeat(40));
    
    const latest = await db.collection('attendances')
      .find({})
      .sort({_id: -1})
      .limit(3)
      .toArray();
    
    latest.forEach((record, i) => {
      console.log(`\nRecord ${i + 1}:`);
      console.log(`  Type: ${record.attendanceType || 'student'}`);
      
      if (record.attendanceType === 'teacher') {
        console.log(`  Teacher ID: ${record.teacherId}`);
        console.log(`  Check-in: ${record.teacherCheckIn ? new Date(record.teacherCheckIn).toLocaleString() : 'N/A'}`);
      } else {
        console.log(`  Student ID: ${record.studentId}`);
        console.log(`  Teacher ID: ${record.teacherId}`);
        console.log(`  Subject: ${record.subject || 'N/A'}`);
        console.log(`  Class: ${record.className || record.class || 'N/A'}`);
      }
      
      console.log(`  Date: ${record.date ? new Date(record.date).toDateString() : 'N/A'}`);
      console.log(`  Time: ${record.scanTime ? new Date(record.scanTime).toLocaleTimeString() : 'N/A'}`);
    });
    
    console.log('\n' + '─'.repeat(40));
    
    // 4. Check if QR system is working
    if (studentAtt > 0) {
      console.log('✅ QR SYSTEM IS WORKING!');
      console.log('   Student attendance is being recorded via QR scans.');
    } else if (teacherAtt > 0) {
      console.log('⚠️ Teacher QR working, but no student scans yet.');
      console.log('   Need students to scan teacher QR.');
    } else {
      console.log('❌ No QR attendance recorded yet.');
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkQRAttendance();