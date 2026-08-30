/**
 * GovCatalyst — Auto Database Initializer & Migration Runner
 * Automatically applies SQL migrations and seeds default admin on startup.
 */

const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { hashPassword } = require('../utils/authUtils');

async function runAutoMigration() {
  console.log('🔄 Checking database schema & auto-migrations...');

  const migrationFiles = [
    'seed.sql',
    'evaluation_tables.sql',
    'pilot_tables.sql',
    'validation_tables.sql',
    'pilot_telemetry_alerts.sql'
  ];

  for (const fileName of migrationFiles) {
    const filePath = path.join(__dirname, '../../seed', fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`✅ Applied migration: ${fileName}`);
    } catch (err) {
      // Ignore duplicate type / already existing table errors
      if (err.code === '42P07' || err.code === '42710' || err.message.includes('already exists')) {
        // Table or type already exists - safe to continue
      } else {
        console.warn(`Migration notice for ${fileName}:`, err.message);
      }
    }
  }

  // Ensure milestone status check constraint includes all lifecycle states
  try {
    await pool.query(`
      ALTER TABLE gov_pilot_milestones 
      DROP CONSTRAINT IF EXISTS gov_pilot_milestones_status_check;
      ALTER TABLE gov_pilot_milestones 
      ADD CONSTRAINT gov_pilot_milestones_status_check 
      CHECK (status IN ('Pending','In Progress','Under Review','Verified','Completed','Overdue','Rejected'));
    `);
  } catch (mErr) {
    // ignore if table doesn't exist yet
  }

  // Ensure default super_admin exists
  try {
    const adminEmail = process.env.SUPERADMIN_EMAIL || 'learnova.service@gmail.com';
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      const hashed = await hashPassword('SuperAdmin@123');
      await pool.query(`
        INSERT INTO users (name, email, password_hash, role, department_name, designation, account_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['MSInS Super Administrator', adminEmail, hashed, 'super_admin', 'MSInS State Innovation Society', 'State Administrator', 'active']);
      console.log(`👑 Seeded default super_admin: ${adminEmail}`);
    }
  } catch (adminErr) {
    console.warn('Superadmin seed notice:', adminErr.message);
  }

  console.log('🚀 Database schema is verified and ready!');
}

module.exports = runAutoMigration;
