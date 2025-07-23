const sequelize = require('../config/database');
const Account = require('./User');
const Order = require('./Order');
const OrderItem = require('./OrderItem');

// Define associations
Account.hasMany(Order, {
  foreignKey: 'account_id',
  as: 'orders'
});

Order.belongsTo(Account, {
  foreignKey: 'account_id',
  as: 'account'
});

Order.hasMany(OrderItem, {
  foreignKey: 'order_id',
  as: 'OrderItems'
});

OrderItem.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Check if this is a fresh database or needs migration
    const [userTableResults] = await sequelize.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='users'
    `);
    
    const [accountTableResults] = await sequelize.query(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'
    `);
    
    if (userTableResults.length > 0 && accountTableResults.length === 0) {
      // Existing database with users table - run migration
      console.log('Existing database detected, running migration...');
      const migration = require('../migrations/001-migrate-to-sequelize');
      await migration.up(sequelize.getQueryInterface(), sequelize);
      console.log('Migration completed successfully.');
    }
    
    // Check if fulfilled_time column exists
    const [fulfilledTimeResults] = await sequelize.query(`
      PRAGMA table_info(orders)
    `);
    const hasFullilledTime = fulfilledTimeResults.some(column => column.name === 'fulfilled_time');
    
    if (!hasFullilledTime) {
      console.log('Adding fulfilled_time column to orders table...');
      const fulfilledTimeMigration = require('../migrations/005-add-fulfilled-time');
      await fulfilledTimeMigration.up(sequelize.getQueryInterface(), sequelize);
      console.log('fulfilled_time column added successfully.');
    }
    
    // Check if plaintext_debug column exists
    const [accountTableInfo] = await sequelize.query(`
      PRAGMA table_info(accounts)
    `);
    const hasPlaintextDebug = accountTableInfo.some(column => column.name === 'plaintext_debug');
    
    if (!hasPlaintextDebug) {
      console.log('Adding plaintext_debug column to accounts table...');
      const plaintextDebugMigration = require('../migrations/006-add-plaintext-debug-column');
      await plaintextDebugMigration.up(sequelize.getQueryInterface(), sequelize);
      console.log('plaintext_debug column added successfully.');
    }
    
    // Check if reset_token columns exist
    const hasResetToken = accountTableInfo.some(column => column.name === 'reset_token');
    
    if (!hasResetToken) {
      console.log('Adding reset_token columns to accounts table...');
      const resetTokenMigration = require('../migrations/007-add-reset-token-columns');
      await resetTokenMigration.up(sequelize.getQueryInterface(), sequelize);
      console.log('reset_token columns added successfully.');
    }
    
    // Fresh database or already migrated - just sync
    await sequelize.sync({ force: false });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Account,
  Order,
  OrderItem,
  syncDatabase
};