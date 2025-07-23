const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('accounts');
    if (tableInfo.plaintext_debug) {
      await queryInterface.removeColumn('accounts', 'plaintext_debug');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('accounts', 'plaintext_debug', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Debug field storing plaintext password - DO NOT USE IN PRODUCTION',
    });
  }
};