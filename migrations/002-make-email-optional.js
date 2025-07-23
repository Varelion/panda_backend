const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Make email column nullable in accounts table
      await queryInterface.changeColumn('accounts', 'email', {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      }, { transaction });
      
      console.log('Successfully made email column optional in accounts table');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to make email optional:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, update any NULL email values to a placeholder
      // This is needed because we can't make a column NOT NULL if it contains NULL values
      await queryInterface.sequelize.query(`
        UPDATE accounts 
        SET email = CONCAT('placeholder_', id, '@example.com') 
        WHERE email IS NULL
      `, { transaction });
      
      // Make email column required again
      await queryInterface.changeColumn('accounts', 'email', {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      }, { transaction });
      
      console.log('Successfully reverted email column to required in accounts table');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to revert email column:', error);
      throw error;
    }
  }
};