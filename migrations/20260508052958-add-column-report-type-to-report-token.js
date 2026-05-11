'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('report_token', 'reportType', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'default',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('report_token', 'reportType');
  }
};
