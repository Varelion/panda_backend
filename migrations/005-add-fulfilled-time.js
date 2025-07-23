const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('orders', 'fulfilled_time', {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'fulfilled_time');
  }
};