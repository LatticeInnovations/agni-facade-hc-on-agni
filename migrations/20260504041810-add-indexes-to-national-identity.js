'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addIndex('national_identity', ['created_at'], {
      name: 'idx_national_identity_created_at'
    });
    await queryInterface.addIndex('national_identity', ['updated_at'], {
      name: 'idx_national_identity_updated_at'
    });

  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeIndex('national_identity', 'idx_national_identity_created_at');
    await queryInterface.removeIndex('national_identity', 'idx_national_identity_updated_at');
  }
};
