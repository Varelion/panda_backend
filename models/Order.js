const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Order extends Model {
  async markCompleteAndAwardTokens(tokensToAward) {
    const Account = require('./User');
    
    if (this.delivered) {
      throw new Error('Order already completed');
    }

    const transaction = await sequelize.transaction();
    
    try {
      await this.update({
        delivered: true,
        tokens_awarded: tokensToAward,
        status: 'delivered',
        fulfilled_time: new Date()
      }, { transaction });

      const account = await Account.findByPk(this.account_id, { transaction });
      if (!account) {
        throw new Error('Account not found');
      }

      await account.addTokens(tokensToAward, transaction);
      await account.updateMetrics(0, 1, tokensToAward, transaction);

      await transaction.commit();
      
      return {
        orderId: this.id,
        accountId: this.account_id,
        tokensAwarded: tokensToAward
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getTotalValue() {
    const items = await this.getOrderItems();
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}

Order.init({
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
  secret_menu_tokens: {
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
  },
  fulfilled_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Order',
  tableName: 'orders',
  createdAt: 'order_date',
  updatedAt: false,
  hooks: {
    afterCreate: async (order, options) => {
      const Account = require('./User');
      const account = await Account.findByPk(order.account_id, { transaction: options.transaction });
      if (account && order.total_amount > 0) {
        await account.increment({
          total_gold_spent: parseFloat(order.total_amount),
          total_orders_completed: 0,
          total_tokens_earned: 0,
        }, { transaction: options.transaction });
      }
    }
  }
});

// Legacy compatibility methods for existing code
Order.createOrder = async (orderData) => {
  const { user_id, items, ...orderFields } = orderData;
  
  const transaction = await sequelize.transaction();
  
  try {
    const order = await Order.create({
      ...orderFields,
      account_id: user_id
    }, { transaction });

    if (items && items.length > 0) {
      const OrderItem = require('./OrderItem');
      const orderItems = items.map(item => ({
        order_id: order.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price
      }));
      
      await OrderItem.bulkCreate(orderItems, { transaction });
    }

    await transaction.commit();
    return order;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

Order.findByUserId = async (userId) => {
  const Account = require('./User');
  return Order.findAll({
    where: { account_id: userId },
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['username', 'email']
      },
      {
        association: 'OrderItems'
      }
    ],
    order: [['order_date', 'DESC']]
  });
};

Order.findById = async (id) => {
  const Account = require('./User');
  return Order.findByPk(id, {
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['username', 'email']
      },
      {
        association: 'OrderItems'
      }
    ]
  });
};

Order.updateStatus = async (id, status) => {
  const updateData = { status };
  
  // Set fulfilled_time when status is changed to delivered
  if (status === 'delivered') {
    updateData.fulfilled_time = new Date();
    updateData.delivered = true;
  }
  
  const [affectedRows] = await Order.update(
    updateData,
    { where: { id } }
  );
  return affectedRows > 0;
};

Order.updateDelivered = async (id, delivered) => {
  const updateData = { delivered };
  
  // Set fulfilled_time when marking as delivered
  if (delivered) {
    updateData.fulfilled_time = new Date();
    updateData.status = 'delivered';
  }
  
  const [affectedRows] = await Order.update(
    updateData,
    { where: { id } }
  );
  return affectedRows > 0;
};

Order.getAllOrders = async () => {
  const Account = require('./User');
  return Order.findAll({
    include: [
      {
        model: Account,
        as: 'account',
        attributes: ['username', 'email']
      },
      {
        association: 'OrderItems'
      }
    ],
    order: [['order_date', 'DESC']]
  });
};

Order.delete = async (id) => {
  const deletedRows = await Order.destroy({ where: { id } });
  return deletedRows > 0;
};

Order.markCompleteAndAwardTokens = async (id, tokensToAward) => {
  const order = await Order.findByPk(id);
  if (!order) throw new Error('Order not found');
  return order.markCompleteAndAwardTokens(tokensToAward);
};

module.exports = Order;