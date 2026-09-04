/**
 * Fix milestone seeding for PILOT-2026-1001
 * Check valid status values and re-seed milestones
 */
const { Client } = require('pg');
const PROD_DB = 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge';

(async () => {
  const client = new Client({ connectionString: PROD_DB, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check the constraint definition
  const { rows: constraints } = await client.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'gov_pilot_milestones' AND c.contype = 'c'
  `);
  console.log('Constraints on gov_pilot_milestones:');
  constraints.forEach(c => console.log(' ', c.def));

  // Get the pilot ID
  const { rows: pilots } = await client.query(
    "SELECT id, pilot_code, status FROM gov_pilots WHERE pilot_code = 'PILOT-2026-1001'"
  );
  if (!pilots.length) { console.log('Pilot not found'); await client.end(); return; }
  const pilot = pilots[0];
  console.log(`\nPilot: ${pilot.pilot_code} [${pilot.status}] ID: ${pilot.id}`);

  // Check existing milestones
  const { rows: ms } = await client.query(
    "SELECT milestone_code, name, status FROM gov_pilot_milestones WHERE pilot_id = $1 ORDER BY phase",
    [pilot.id]
  );
  console.log(`\nExisting milestones (${ms.length}):`);
  ms.forEach(m => console.log(` [${m.status}] ${m.milestone_code} ${m.name}`));

  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
