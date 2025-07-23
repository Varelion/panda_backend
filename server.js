const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { syncDatabase } = require('./models');

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
app.use('/api/orders', require('./routes/orders'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await syncDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Database connected and Sequelize models synchronized');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
