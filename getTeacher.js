// getTeacher.js
const mongoose = require('mongoose');
require('dotenv').config();

async function getTeacher() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    const Teacher = require('./models/Teacher');
    const teacher = await Teacher.findOne();
    
    if (teacher) {
      console.log('✅ Found teacher:');
      console.log('ID:', teacher._id);
      console.log('Name:', teacher.name);
      console.log('Email:', teacher.email);
      console.log('\n📋 Copy this ID for testing:');
      console.log(teacher._id.toString());
    } else {
      console.log('❌ No teachers found');
      console.log('\nRegister a teacher first:');
      console.log('POST http://localhost:5000/api/auth/teacher/register');
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getTeacher();