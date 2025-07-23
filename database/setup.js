const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'panda.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create users table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    delivered BOOLEAN DEFAULT 0,
    character_name TEXT,
    delivery_location TEXT,
    coupon_used TEXT,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivery_address TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Create order_items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  // Migration: Add is_admin column to users table if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_admin column:', err.message);
    }
  });

  // Migration: Add delivered column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN delivered BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding delivered column:', err.message);
    }
  });

  // Migration: Add character_name column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN character_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding character_name column:', err.message);
    }
  });

  // Migration: Add delivery_location column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN delivery_location TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding delivery_location column:', err.message);
    }
  });

  // Migration: Add coupon_used column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN coupon_used TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding coupon_used column:', err.message);
    }
  });

  // Migration: Add reward_tokens column to users table if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN reward_tokens INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding reward_tokens column:', err.message);
    }
  });

  // Migration: Add tokens_awarded column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN tokens_awarded INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding tokens_awarded column:', err.message);
    }
  });

  // Migration: Add tokens_used column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN tokens_used INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding tokens_used column:', err.message);
    }
  });

  // Migration: Add secret_menu_tokens column to orders table if it doesn't exist
  db.run(`ALTER TABLE orders ADD COLUMN secret_menu_tokens INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding secret_menu_tokens column:', err.message);
    }
  });

  console.log('Database tables created successfully');
});

module.exports = db;