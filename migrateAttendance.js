// migrateAttendance.js - UPDATED VERSION
const mongoose = require('mongoose');
require('dotenv').config();

async function migrateAttendance() {
  try {
    console.log('🚀 Starting attendance migration...');
    
    // Get MongoDB URI from environment or use default
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qr-attendance';
    console.log(`🔗 Connecting to: ${mongoURI}`);
    
    // Connect to MongoDB with updated options
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    
    // Get database reference
    const db = mongoose.connection.db;
    
    // Get the attendance collection
    const attendanceCollection = db.collection('attendances');
    
    // Count total documents
    const totalCount = await attendanceCollection.countDocuments();
    console.log(`📊 Total attendance records: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('📭 No attendance records found. Creating fresh collection...');
      
      // Close connection
      await mongoose.connection.close();
      console.log('✅ Migration completed (no data to migrate)');
      return;
    }
    
    // STEP 1: Check if attendanceType field exists
    const hasAttendanceType = await attendanceCollection.findOne({ 
      attendanceType: { $exists: true } 
    });
    
    if (hasAttendanceType) {
      console.log('✅ attendanceType field already exists. Skipping migration.');
      
      // Show current counts
      const studentCount = await attendanceCollection.countDocuments({ attendanceType: 'student' });
      const teacherCount = await attendanceCollection.countDocuments({ attendanceType: 'teacher' });
      
      console.log(`   Student attendance: ${studentCount}`);
      console.log(`   Teacher attendance: ${teacherCount}`);
      
      await mongoose.connection.close();
      console.log('✅ Migration check completed');
      return;
    }
    
    // STEP 2: Add new fields to all existing records
    console.log('🔄 Adding new fields to existing records...');
    
    // First, let's see what fields currently exist
    const sampleRecord = await attendanceCollection.findOne();
    console.log('📄 Sample record fields:', Object.keys(sampleRecord));
    
    // Update all records to add attendanceType field
    // All existing records are student attendance
    const updateResult = await attendanceCollection.updateMany(
      {}, // Update all documents
      {
        $set: {
          attendanceType: 'student',
          status: 'present',
          scanTime: new Date(), // Set to current time
          markedBy: 'migration',
          remarks: 'Migrated to new schema'
        }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} records`);
    
    // STEP 3: Create indexes
    console.log('🔧 Creating indexes...');
    
    try {
      await attendanceCollection.createIndex({ teacherId: 1, date: 1 });
      console.log('   ✅ Index: teacherId + date');
    } catch (e) {
      console.log('   ⚠️ Index exists: teacherId + date');
    }
    
    try {
      await attendanceCollection.createIndex({ studentId: 1, date: 1 });
      console.log('   ✅ Index: studentId + date');
    } catch (e) {
      console.log('   ⚠️ Index exists: studentId + date');
    }
    
    try {
      await attendanceCollection.createIndex({ institutionCode: 1, date: 1 });
      console.log('   ✅ Index: institutionCode + date');
    } catch (e) {
      console.log('   ⚠️ Index exists: institutionCode + date');
    }
    
    try {
      await attendanceCollection.createIndex({ attendanceType: 1 });
      console.log('   ✅ Index: attendanceType');
    } catch (e) {
      console.log('   ⚠️ Index exists: attendanceType');
    }
    
    try {
      await attendanceCollection.createIndex({ sessionId: 1 });
      console.log('   ✅ Index: sessionId');
    } catch (e) {
      console.log('   ⚠️ Index exists: sessionId');
    }
    
    // STEP 4: Verify migration
    console.log('\n📋 Verification Results:');
    
    const updatedCount = await attendanceCollection.countDocuments({ attendanceType: 'student' });
    console.log(`   ✅ Student attendance: ${updatedCount}`);
    
    const teacherCount = await attendanceCollection.countDocuments({ attendanceType: 'teacher' });
    console.log(`   📝 Teacher attendance: ${teacherCount} (will be 0 initially)`);
    
    const missingType = await attendanceCollection.countDocuments({ 
      attendanceType: { $exists: false } 
    });
    console.log(`   ❌ Missing attendanceType: ${missingType}`);
    
    if (missingType > 0) {
      console.log('🔄 Fixing remaining records...');
      await attendanceCollection.updateMany(
        { attendanceType: { $exists: false } },
        { $set: { attendanceType: 'student' } }
      );
      console.log('✅ Fixed remaining records');
    }
    
    // Show a sample
    console.log('\n📄 Sample migrated record:');
    const sample = await attendanceCollection.findOne({ attendanceType: 'student' });
    if (sample) {
      console.log({
        _id: sample._id,
        attendanceType: sample.attendanceType,
        studentId: sample.studentId ? 'Exists' : 'Missing',
        teacherId: sample.teacherId ? 'Exists' : 'Missing',
        date: sample.date,
        status: sample.status || 'Not set'
      });
    }
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('Error details:', error);
    
    try {
      await mongoose.connection.close();
    } catch (e) {
      console.log('Could not close connection');
    }
    
    process.exit(1);
  }
}

// Run migration
migrateAttendance();