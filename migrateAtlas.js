// migrateAtlas.js - SPECIFICALLY FOR MONGODB ATLAS
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function migrateAtlas() {
  console.log('🚀 Starting MongoDB Atlas Migration...');
  
  // Get your Atlas connection string from .env
  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    console.error('❌ MONGODB_URI not found in .env file');
    console.log('💡 Your .env file should have:');
    console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/yourdb');
    process.exit(1);
  }
  
  console.log('🔗 Connecting to MongoDB Atlas...');
  
  const client = new MongoClient(mongoURI, {
    // Atlas specific options
    serverSelectionTimeoutMS: 30000, // 30 seconds
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    // Get database name from connection string or use default
    const dbName = mongoURI.split('/').pop().split('?')[0] || 'qr-attendance';
    const db = client.db(dbName);
    
    console.log(`📁 Using database: ${dbName}`);
    
    // Get attendance collection
    const attendanceCollection = db.collection('attendances');
    
    // Count total documents
    const totalCount = await attendanceCollection.countDocuments();
    console.log(`📊 Total attendance records: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('📭 No attendance records found. Ready for new data.');
      return;
    }
    
    // Check if already migrated
    const alreadyMigrated = await attendanceCollection.findOne({ 
      attendanceType: { $exists: true } 
    });
    
    if (alreadyMigrated) {
      console.log('✅ Already migrated. Checking counts...');
      
      const studentCount = await attendanceCollection.countDocuments({ attendanceType: 'student' });
      const teacherCount = await attendanceCollection.countDocuments({ attendanceType: 'teacher' });
      
      console.log(`   📚 Student attendance: ${studentCount}`);
      console.log(`   👨‍🏫 Teacher attendance: ${teacherCount}`);
      
      const missingType = await attendanceCollection.countDocuments({ 
        attendanceType: { $exists: false } 
      });
      
      if (missingType > 0) {
        console.log(`   ⚠️ ${missingType} records need migration`);
        console.log('🔄 Fixing remaining records...');
        
        const fixResult = await attendanceCollection.updateMany(
          { attendanceType: { $exists: false } },
          { $set: { attendanceType: 'student', status: 'present' } }
        );
        
        console.log(`✅ Fixed ${fixResult.modifiedCount} records`);
      }
      
      return;
    }
    
    // MIGRATION: Add new fields
    console.log('🔄 Migrating attendance records...');
    
    // Get a sample to understand current structure
    const sample = await attendanceCollection.findOne();
    console.log('📄 Current record structure:');
    console.log(JSON.stringify(sample, null, 2).substring(0, 500) + '...');
    
    // Update all records
    const updateResult = await attendanceCollection.updateMany(
      {}, // Update all documents
      {
        $set: {
          attendanceType: 'student',
          status: 'present',
          scanTime: new Date(),
          markedBy: 'atlas_migration',
          remarks: 'Migrated for teacher QR support'
        }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} records`);
    
    // Create indexes
    console.log('🔧 Creating indexes...');
    
    const indexesToCreate = [
      { teacherId: 1, date: 1 },
      { studentId: 1, date: 1 },
      { institutionCode: 1, date: 1 },
      { attendanceType: 1 },
      { sessionId: 1 }
    ];
    
    for (const index of indexesToCreate) {
      try {
        await attendanceCollection.createIndex(index);
        console.log(`   ✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.codeName === 'IndexKeySpecsConflict') {
          console.log(`   ⚠️ Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.log(`   ⚠️ Could not create index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }
    
    // Verify
    console.log('\n📋 Migration Verification:');
    
    const finalStudentCount = await attendanceCollection.countDocuments({ attendanceType: 'student' });
    const finalTeacherCount = await attendanceCollection.countDocuments({ attendanceType: 'teacher' });
    
    console.log(`   ✅ Student attendance: ${finalStudentCount}`);
    console.log(`   ✅ Teacher attendance: ${finalTeacherCount}`);
    
    const remaining = await attendanceCollection.countDocuments({ 
      attendanceType: { $exists: false } 
    });
    
    console.log(`   ❌ Remaining unmigrated: ${remaining}`);
    
    if (remaining === 0) {
      console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    } else {
      console.log('\n⚠️ Some records need manual attention');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    
    // Helpful error messages for common Atlas issues
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('1. Check your internet connection');
      console.log('2. Verify your Atlas cluster is running');
      console.log('3. Whitelist your IP in Atlas Network Access');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('1. Check username/password in connection string');
      console.log('2. Verify database user has correct privileges');
    }
    
  } finally {
    // Close connection
    await client.close();
    console.log('🔌 Connection closed');
  }
}

// Run migration
migrateAtlas();