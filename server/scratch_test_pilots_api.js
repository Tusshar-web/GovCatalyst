/**
 * Scratch: Test GET /api/pilots endpoint with real JWT
 * Run: node scratch_test_pilots_api.js
 */
const pool = require('./src/config/db');
const { generateToken } = require('./src/utils/authUtils');
const http = require('http');

async function test() {
  // 1. Get a valid user from DB
  const { rows: users } = await pool.query(
    "SELECT * FROM users WHERE account_status = 'active' LIMIT 3"
  );
  console.log('--- Active users in DB ---');
  users.forEach(u => console.log(` [${u.role}] ${u.email}`));

  if (!users.length) {
    console.log('No active users found — cannot generate token');
    pool.end();
    return;
  }

  const user = users[0];
  const token = generateToken({ user_id: user.id, email: user.email, role: user.role });
  console.log(`\nUsing: ${user.email} (${user.role})`);
  console.log('Token (first 40 chars):', token.substring(0, 40) + '...');

  // 2. Hit /api/pilots
  const options = {
    hostname: 'localhost',
    port: 5009,
    path: '/api/pilots',
    headers: { Authorization: 'Bearer ' + token }
  };

  const req = http.get(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('\n--- GET /api/pilots ---');
      console.log('HTTP Status:', res.statusCode);
      try {
        const d = JSON.parse(body);
        console.log('success:', d.success);
        console.log('message:', d.message);
        console.log('data count:', Array.isArray(d.data) ? d.data.length : typeof d.data);
        if (Array.isArray(d.data) && d.data.length > 0) {
          console.log('First pilot:', JSON.stringify(d.data[0], null, 2));
        }
        if (!d.success) {
          console.log('Full error response:', JSON.stringify(d, null, 2));
        }
      } catch (e) {
        console.log('Raw body:', body.substring(0, 500));
      }
      pool.end();
    });
  });

  req.on('error', e => {
    console.error('\nConnection error:', e.message);
    console.error('Is the server running on port 5009?');
    pool.end();
  });
}

test().catch(e => {
  console.error('Fatal error:', e.message);
  pool.end();
});
