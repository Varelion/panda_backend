const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database/panda.db'),
  logging: false, // Set to console.log to see SQL queries
  define: {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

module.exports = sequelize;