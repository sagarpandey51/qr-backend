// checkAttendance.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkAttendance() {
  try {
    console.log('🔍 Checking attendance database...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Count all attendance
    const totalCount = await db.collection('attendances').countDocuments();
    console.log('📊 Total attendance records:', totalCount);
    
    if (totalCount > 0) {
      // Get latest 5 records
      const latestRecords = await db.collection('attendances')
        .find({})
        .sort({_id: -1})
        .limit(5)
        .toArray();
      
      console.log('\n📝 Latest 5 attendance records:');
      console.log('='.repeat(50));
      
      latestRecords.forEach((record, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log('  Type:', record.attendanceType || 'student');
        console.log('  Student ID:', record.studentId ? 'Yes' : 'No');
        console.log('  Teacher ID:', record.teacherId ? 'Yes' : 'No');
        console.log('  Subject:', record.subject || 'N/A');
        console.log('  Class:', record.className || record.class || 'N/A');
        console.log('  Date:', record.date ? new Date(record.date).toLocaleDateString() : 'N/A');
        console.log('  Time:', record.scanTime ? new Date(record.scanTime).toLocaleTimeString() : 'N/A');
        console.log('  Status:', record.status || 'present');
        
        if (record.attendanceType === 'teacher') {
          console.log('  Check-in:', record.teacherCheckIn ? new Date(record.teacherCheckIn).toLocaleTimeString() : 'N/A');
          console.log('  Check-out:', record.teacherCheckOut ? new Date(record.teacherCheckOut).toLocaleTimeString() : 'N/A');
        }
      });
      
      console.log('='.repeat(50));
    }
    
    // Count by type
    const teacherCount = await db.collection('attendances').countDocuments({ attendanceType: 'teacher' });
    const studentCount = await db.collection('attendances').countDocuments({ attendanceType: 'student' });
    
    console.log('\n📈 SUMMARY:');
    console.log('  Teacher attendance:', teacherCount);
    console.log('  Student attendance:', studentCount);
    console.log('  Total:', teacherCount + studentCount);
    
    // Check if we have any student with email jon@gmail.com
    const student = await db.collection('students').findOne({
      email: 'jon@gmail.com'
    });
    
    if (student) {
      console.log(`\n👤 Found student: ${student.name} (${student.email})`);
      const jonAttendance = await db.collection('attendances').find({
        studentId: student._id
      }).countDocuments();
      
      console.log(`  Attendance records: ${jonAttendance}`);
    } else {
      console.log('\n❌ No student found with email: jon@gmail.com');
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the function
checkAttendance();