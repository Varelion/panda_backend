const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Add reset_token column
      await queryInterface.addColumn('accounts', 'reset_token', {
        type: DataTypes.STRING,
        allowNull: true,
      }, { transaction });

      // Add reset_token_expires column
      await queryInterface.addColumn('accounts', 'reset_token_expires', {
        type: DataTypes.DATE,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove reset_token column
      await queryInterface.removeColumn('accounts', 'reset_token', { transaction });

      // Remove reset_token_expires column
      await queryInterface.removeColumn('accounts', 'reset_token_expires', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};