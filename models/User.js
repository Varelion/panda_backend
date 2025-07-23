const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

class Account extends Model {
  async checkPassword(password) {
    return bcrypt.compare(password, this.password);
  }

  async updateMetrics(goldSpent = 0, ordersCompleted = 0, tokensEarned = 0, transaction = null) {
    await this.increment({
      total_gold_spent: goldSpent,
      total_orders_completed: ordersCompleted,
      total_tokens_earned: tokensEarned,
    }, { transaction });
    return this.reload({ transaction });
  }

  async addTokens(amount, transaction = null) {
    await this.increment('reward_tokens', { by: amount, transaction });
    await this.increment('total_tokens_earned', { by: amount, transaction });
    return this.reload({ transaction });
  }

  async subtractTokens(amount) {
    if (this.reward_tokens < amount) {
      throw new Error('Insufficient tokens');
    }
    await this.decrement('reward_tokens', { by: amount });
    return this.reload();
  }

  toJSON() {
    const values = Object.assign({}, this.get());
    delete values.password;
    delete values.reset_token;
    delete values.reset_token_expires;
    return values;
  }
}

Account.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: 'Must be a valid email address',
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [6, 255],
      },
    },
    reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_token_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reward_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    total_gold_spent: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    total_orders_completed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    total_tokens_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Account',
    tableName: 'accounts',
    hooks: {
      beforeCreate: async (account) => {
        if (account.password) {
          account.password = await bcrypt.hash(account.password, 12);
        }
      },
      beforeUpdate: async (account) => {
        if (account.changed('password')) {
          account.password = await bcrypt.hash(account.password, 12);
        }
      },
    },
  },
);

// Static methods for legacy compatibility
Account.findByEmail = async (email) => {
  return Account.findOne({ where: { email } });
};

Account.findByUsername = async (username) => {
  return Account.findOne({ where: { username } });
};

Account.findById = async (id) => {
  return Account.findByPk(id);
};

Account.getAllAccounts = async () => {
  return Account.findAll({
    attributes: { exclude: ['password'] },
  });
};

Account.updateTokens = async (id, tokens) => {
  const [affectedRows] = await Account.update({ reward_tokens: tokens }, { where: { id } });
  return affectedRows > 0;
};

Account.addTokens = async (id, tokensToAdd) => {
  const account = await Account.findByPk(id);
  if (!account) throw new Error('Account not found');
  return account.addTokens(tokensToAdd);
};

Account.subtractTokens = async (id, tokensToSubtract) => {
  const account = await Account.findByPk(id);
  if (!account) throw new Error('Account not found');
  return account.subtractTokens(tokensToSubtract);
};

module.exports = Account;
