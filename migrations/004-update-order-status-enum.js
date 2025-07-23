const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, update any existing 'processing' status to 'confirmed'
      await queryInterface.sequelize.query(`
        UPDATE orders SET status = 'confirmed' WHERE status = 'processing'
      `, { transaction });

      // Update any existing 'shipped' status to 'ready'
      await queryInterface.sequelize.query(`
        UPDATE orders SET status = 'ready' WHERE status = 'shipped'
      `, { transaction });

      // Drop the old constraint and recreate with new enum values
      // Note: This approach works for SQLite. For other databases, you might need a different approach.
      await queryInterface.sequelize.query(`
        CREATE TABLE orders_new AS SELECT * FROM orders
      `, { transaction });

      await queryInterface.dropTable('orders', { transaction });

      await queryInterface.createTable('orders', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        account_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'accounts',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        total_amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        status: {
          type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'),
          defaultValue: 'pending'
        },
        delivered: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        character_name: {
          type: DataTypes.STRING,
          allowNull: true
        },
        delivery_location: {
          type: DataTypes.STRING,
          allowNull: true
        },
        delivery_address: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        coupon_used: {
          type: DataTypes.STRING,
          allowNull: true
        },
        tokens_used: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        tokens_awarded: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        special_instructions: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        order_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO orders SELECT * FROM orders_new
      `, { transaction });

      await queryInterface.dropTable('orders_new', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Revert status changes
      await queryInterface.sequelize.query(`
        UPDATE orders SET status = 'processing' WHERE status = 'confirmed'
      `, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE orders SET status = 'shipped' WHERE status = 'ready'
      `, { transaction });

      // Recreate table with old enum values
      await queryInterface.sequelize.query(`
        CREATE TABLE orders_new AS SELECT * FROM orders
      `, { transaction });

      await queryInterface.dropTable('orders', { transaction });

      await queryInterface.createTable('orders', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        account_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'accounts',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        total_amount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          validate: {
            min: 0
          }
        },
        status: {
          type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
          defaultValue: 'pending'
        },
        delivered: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        character_name: {
          type: DataTypes.STRING,
          allowNull: true
        },
        delivery_location: {
          type: DataTypes.STRING,
          allowNull: true
        },
        delivery_address: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        coupon_used: {
          type: DataTypes.STRING,
          allowNull: true
        },
        tokens_used: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        tokens_awarded: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        order_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        }
      }, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO orders SELECT 
          id, account_id, total_amount, status, delivered, character_name, 
          delivery_location, delivery_address, coupon_used, tokens_used, 
          tokens_awarded, notes, order_date
        FROM orders_new
      `, { transaction });

      await queryInterface.dropTable('orders_new', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};