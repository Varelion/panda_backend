'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('accounts');
    if (!tableInfo.plaintext_debug) {
      await queryInterface.addColumn('accounts', 'plaintext_debug', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('accounts', 'plaintext_debug');
  }
};