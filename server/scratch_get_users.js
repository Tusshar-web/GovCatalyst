require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role, department_name, designation, account_status, created_at FROM users ORDER BY role, created_at');
    console.log('\n=== CURRENT USERS IN DATABASE ===\n');
    rows.forEach(u => {
      console.log(`Role:   ${u.role.toUpperCase()}`);
      console.log(`Name:   ${u.name}`);
      console.log(`Email:  ${u.email}`);
      console.log(`Status: ${u.account_status}`);
      console.log(`Dept:   ${u.department_name || 'N/A'}`);
      console.log('-----------------------------------');
    });
    console.log(`\nTotal Users: ${rows.length}`);
  } catch (e) {
    console.error('Error fetching users:', e.message);
  } finally {
    process.exit(0);
  }
})();
