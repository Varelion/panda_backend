// server.js (Clean version)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getAllUsers } = require('./data/users');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: 'http://localhost:5173', // Vite dev server
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('End of server, users: ', getAllUsers());
});
