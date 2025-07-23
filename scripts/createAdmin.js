const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../database/setup');

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findByEmail('admin@panda.com');

    if (existingAdmin) {
      console.log('Admin user already exists');

      // Update existing user to be admin
      const stmt = db.prepare(`
        UPDATE users
        SET is_admin = 1
        WHERE email = ?
      `);

      stmt.run(['admin@panda.com'], function(err) {
        if (err) {
          console.error('Error updating admin status:', err);
        } else {
          console.log('Updated existing user to admin status');
        }
      });

      stmt.finalize();
      return;
    }

    // Hash password
    // const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    const adminUser = await User.create({
      username: 'admin',
      email: '',
      password: "vLe093anCri",
    });

    // Set admin flag
    const stmt = db.prepare(`
      UPDATE users
      SET is_admin = 1, reward_tokens = 1000
      WHERE id = ?
    `);

    stmt.run([adminUser.id], function(err) {
      if (err) {
        console.error('Error setting admin flag:', err);
      } else {
        console.log('Admin user created successfully!');
        console.log('Email: admin@panda.com');
        console.log('Password: admin123');
        console.log('Tokens: 1000');
      }
    });

    stmt.finalize();

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

createAdminUser();
