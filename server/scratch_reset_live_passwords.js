const { Pool } = require('pg');
const { hashPassword } = require('./src/utils/authUtils');

const pool = new Pool({
  connectionString: 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('Connecting to LIVE Render Database to reset ALL passwords...');
    const pwUser = await hashPassword('Password@123');
    const pwAdmin = await hashPassword('adminpassword123');
    
    // Reset all normal users
    await pool.query('UPDATE users SET password_hash = $1 WHERE role != $2', [pwUser, 'super_admin']);
    
    // Reset all super admins
    await pool.query('UPDATE users SET password_hash = $1 WHERE role = $2', [pwAdmin, 'super_admin']);
    
    console.log('All passwords successfully reset!');
  } catch(e) {
    console.error('Error connecting to live DB:', e);
  } finally {
    pool.end();
  }
})();
