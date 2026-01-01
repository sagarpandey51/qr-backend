const express = require('express');
const app = express();
app.use(express.json());

// Test 1: Direct function
app.post('/test1', (req, res) => {
  console.log('Test 1 - Direct function');
  res.json({ success: true });
});

// Test 2: Using your teacherController
const teacherController = require('./controllers/teacherController');
app.post('/test2', teacherController.registerTeacher);

// Test 3: Wrapped version
app.post('/test3', async (req, res) => {
  console.log('Test 3 - Wrapped');
  try {
    await teacherController.registerTeacher(req, res);
  } catch (error) {
    console.error('Test 3 error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(5001, () => {
  console.log('🧪 Minimal test server on port 5001');
  console.log('Test 1: POST http://localhost:5001/test1');
  console.log('Test 2: POST http://localhost:5001/test2');
  console.log('Test 3: POST http://localhost:5001/test3');
});