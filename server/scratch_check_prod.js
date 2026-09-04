/**
 * Scratch: Check what's in Production DB (users, challenges, applications, pilots)
 * Run: node scratch_check_prod.js
 */
const { Client } = require('pg');

const PROD_DB = 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge';

(async () => {
  const client = new Client({ connectionString: PROD_DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Production DB\n');

  // Users
  const { rows: users } = await client.query(
    "SELECT id, name, email, role, account_status FROM users ORDER BY role, name"
  );
  console.log(`=== USERS (${users.length}) ===`);
  users.forEach(u => console.log(`  [${u.role}] ${u.name} <${u.email}> — ${u.account_status}`));

  // Challenges
  const { rows: challenges } = await client.query(
    "SELECT id, title, status FROM challenges ORDER BY created_at DESC LIMIT 5"
  );
  console.log(`\n=== CHALLENGES (${challenges.length}) ===`);
  challenges.forEach(c => console.log(`  [${c.status}] ${c.id} — ${c.title.substring(0, 60)}`));

  // Applications
  const { rows: apps } = await client.query(
    "SELECT a.id, a.status, u.name as startup_name, a.challenge_id FROM applications a LEFT JOIN users u ON a.startup_id = u.id ORDER BY a.created_at DESC LIMIT 5"
  );
  console.log(`\n=== APPLICATIONS (${apps.length}) ===`);
  apps.forEach(a => console.log(`  [${a.status}] ${a.startup_name} → challenge: ${a.challenge_id}`));

  // gov_pilots table
  try {
    const { rows: pilots } = await client.query("SELECT id, pilot_code, name, startup, status FROM gov_pilots ORDER BY created_at DESC");
    console.log(`\n=== GOV_PILOTS (${pilots.length}) ===`);
    pilots.forEach(p => console.log(`  [${p.status}] ${p.pilot_code} — ${p.name} | startup: ${p.startup}`));
    if (pilots.length === 0) console.log('  (empty — no pilots seeded)');
  } catch (e) {
    console.log('\n=== GOV_PILOTS ===');
    console.log('  Table does not exist yet:', e.message);
  }

  await client.end();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
