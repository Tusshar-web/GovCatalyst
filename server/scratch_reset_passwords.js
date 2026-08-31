require('dotenv').config();
const pool = require('./src/config/db');
const { hashPassword } = require('./src/utils/authUtils');
(async () => {
  try {
    const pw1 = await hashPassword('Password@123');
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [pw1, 'startup@example.com']);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [pw1, 'dept_admin@example.com']);
    
    const pw2 = await hashPassword('adminpassword123');
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [pw2, 'superadmin@govcatalyst.com']);
    console.log('Passwords successfully reset in DB!');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
})();
