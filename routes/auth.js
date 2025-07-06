// routes/auth.js (Clean version)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { addUser, findUserByEmail, findUserById, getAllUsers } = require('../data/users');

const router = express.Router();

// Sign up
router.post('/signup', async (req, res) => {
  console.log('Start of auth', getAllUsers());
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    console.log('Current users:', getAllUsers());

    // Check if user already exists
    const existingUser = findUserByEmail(email);

    if (existingUser) {
      console.log('User already exists');
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: getAllUsers().length + 1,
      username,
      email,
      password: hashedPassword,
    };

    console.log('Before user push');
    addUser(user);
    console.log('After user push');
    console.log('Updated users:', JSON.stringify(getAllUsers(), null, 2));

    // Generate JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sign in
// routes/auth.js (Updated signin route)
router.post('/signin', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Accept either email or username
    const loginField = email || username;

    // Validate input
    if (!loginField || !password) {
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    // Find user by email or username
    let user = findUserByEmail(loginField);
    if (!user && username) {
      // If no user found by email, try finding by username
      user = getAllUsers().find((u) => u.username === loginField);
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile (protected route)
router.get('/profile', authMiddleware, (req, res) => {
  const user = findUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    user: { id: user.id, username: user.username, email: user.email },
  });
});

module.exports = router;
