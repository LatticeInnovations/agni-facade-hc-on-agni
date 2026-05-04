'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable("sync_log", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      sync_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      started_at: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      finished_at: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      inserted: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      updated: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
