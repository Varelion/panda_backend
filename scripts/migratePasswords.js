// Password migration script - converts plaintext passwords to bcrypt hashes
// bcrypt library for secure password hashing
const bcrypt = require('bcryptjs');
// User model for database operations
const Account = require('../models/User');
// Sequelize database connection and ORM
const sequelize = require('../config/database');
// Application logger for tracking migration progress and errors
const logger = require('../utils/logger');

/**
 * Migrates user passwords from plaintext to bcrypt hashes
 * 
 * This function finds all users with plaintext passwords (not starting with $2)
 * and converts them to secure bcrypt hashes. It also stores the original
 * plaintext password in a debug column for troubleshooting purposes.
 * 
 * Security Note: The plaintext_debug column should be removed in production
 * after confirming all passwords work correctly.
 */
async function migratePasswords() {
  try {
    console.log('Starting password migration...');
    logger.info('Password migration started');

    // Find all users with plaintext passwords by checking if password doesn't start with $2
    // bcrypt hashes always start with $2a$, $2b$, $2x$, or $2y$ depending on version
    const users = await Account.findAll({
      attributes: ['id', 'username', 'email', 'password', 'plaintext_debug'],
      where: {
        password: {
          // Use Sequelize operators to find passwords that don't start with $2
          [require('sequelize').Op.not]: {
            [require('sequelize').Op.like]: '$2%' // bcrypt hashes start with $2
          }
        }
      }
    });

    console.log(`Found ${users.length} users with plaintext passwords`);
    logger.info(`Found ${users.length} users with plaintext passwords to migrate`);

    // Early return if no migration is needed
    if (users.length === 0) {
      console.log('No users need password migration');
      logger.info('No users need password migration');
      return;
    }

    // Counters for tracking migration progress
    let migrated = 0;   // Successfully migrated passwords
    let skipped = 0;    // Already hashed passwords (should be rare given our query)

    // Process each user individually to handle errors gracefully
    for (const user of users) {
      try {
        const plaintextPassword = user.password;
        
        // Double-check if password is already hashed (defensive programming)
        // This should be rare since our query filters these out
        if (plaintextPassword.startsWith('$2')) {
          console.log(`Skipping user ${user.username} - already hashed`);
          skipped++;
          continue;
        }

        // Hash the password using bcrypt with salt rounds of 12
        // Salt rounds of 12 provides good security vs performance balance
        const hashedPassword = await bcrypt.hash(plaintextPassword, 12);

        // Update user record with hashed password and store plaintext for debugging
        // Note: plaintext_debug should be removed in production after testing
        await user.update({
          password: hashedPassword,
          plaintext_debug: plaintextPassword // For debugging purposes only
        });

        console.log(`Migrated password for user: ${user.username}`);
        // Log successful migration with relevant user details (no passwords in logs)
        logger.info('Password migrated successfully', {
          userId: user.id,
          username: user.username,
          email: user.email
        });

        migrated++;
      } catch (error) {
        // Log individual user migration errors but continue processing other users
        console.error(`Error migrating password for user ${user.username}:`, error.message);
        logger.error('Password migration failed for user', {
          userId: user.id,
          username: user.username,
          error: error.message
        });
      }
    }

    // Display migration summary with statistics
    console.log('\nMigration Summary:');
    console.log(`Successfully migrated: ${migrated} users`);
    console.log(`Skipped (already hashed): ${skipped} users`);
    console.log(`Failed: ${users.length - migrated - skipped} users`);

    // Log final migration statistics for audit trail
    logger.info('Password migration completed', {
      total: users.length,
      migrated,
      skipped,
      failed: users.length - migrated - skipped
    });

  } catch (error) {
    // Log and re-throw any critical errors that prevent migration
    console.error('Password migration failed:', error);
    logger.error('Password migration failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Execute migration if this script is run directly (not imported as module)
if (require.main === module) {
  (async () => {
    try {
      // Test database connection before starting migration
      await sequelize.authenticate();
      console.log('Database connection established');

      // Execute the password migration process
      await migratePasswords();
      
      console.log('Password migration completed successfully!');
      // Exit with success code
      process.exit(0);
    } catch (error) {
      // Exit with error code if migration fails
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

// Export the migration function for use in other modules or tests
module.exports = { migratePasswords };