const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create new accounts table with proper structure
      await queryInterface.createTable('accounts', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false
        },
        is_admin: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        reward_tokens: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        total_gold_spent: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0
        },
        total_orders_completed: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        total_tokens_earned: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        last_login: {
          type: DataTypes.DATE,
          allowNull: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // Migrate data from users to accounts
      await queryInterface.sequelize.query(`
        INSERT INTO accounts (id, username, email, password, is_admin, reward_tokens, created_at, updated_at)
        SELECT id, username, email, password, is_admin, COALESCE(reward_tokens, 0), created_at, COALESCE(updated_at, created_at)
        FROM users
      `, { transaction });

      // Add account_id column to orders table with default values
      await queryInterface.addColumn('orders', 'account_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'accounts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      }, { transaction });

      // Update orders to use account_id instead of user_id
      await queryInterface.sequelize.query(`
        UPDATE orders SET account_id = user_id
      `, { transaction });

      // Now make account_id NOT NULL
      await queryInterface.changeColumn('orders', 'account_id', {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'accounts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      }, { transaction });

      // Add new columns to orders
      await queryInterface.addColumn('orders', 'total_gold_spent', {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
      }, { transaction });

      // Remove the old users table
      await queryInterface.dropTable('users', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Recreate users table
      await queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false
        },
        is_admin: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        reward_tokens: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      // Migrate data back from accounts to users
      await queryInterface.sequelize.query(`
        INSERT INTO users (id, username, email, password, is_admin, reward_tokens, created_at, updated_at)
        SELECT id, username, email, password, is_admin, reward_tokens, created_at, updated_at
        FROM accounts
      `, { transaction });

      // Remove account_id column from orders
      await queryInterface.removeColumn('orders', 'account_id', { transaction });
      await queryInterface.removeColumn('orders', 'total_gold_spent', { transaction });

      // Drop accounts table
      await queryInterface.dropTable('accounts', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};