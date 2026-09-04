const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Production Database!');

    // 1. Get Dept Admin
    const { rows: users } = await client.query("SELECT id FROM users WHERE email = 'tusshar580@gmail.com' LIMIT 1");
    if (users.length === 0) {
      console.error('Dept Admin not found in prod DB.');
      process.exit(1);
    }
    const deptAdminId = users[0].id;

    // 2. Insert Challenge
    const title = 'AI-Powered Crop Disease Prediction & Real-time Advisory for Rural Farmers';
    const raw_problem_input = 'Farmers in rural Maharashtra are facing massive crop losses due to unseasonal rains and sudden pest attacks. They do not have access to agronomists and spray pesticides blindly, which ruins the soil. We need an app where a farmer can click a photo of a diseased leaf without internet, and the system tells them exactly what disease it is and what organic/chemical spray to use, in Marathi. It should work on low-end smartphones.';
    const outcome_statement = 'The solution must accurately identify at least 15 common diseases in Soybean and Cotton crops from mobile photos with >90% precision. It must operate entirely offline (on-device inference) on smartphones with 2GB RAM or less. The advisory output must be localized in Marathi and must reduce indiscriminate pesticide usage by 30% among the pilot user group (500 farmers) over one crop cycle.';
    
    const query = `
      INSERT INTO challenges (
        dept_admin_id, title, raw_problem_input, outcome_statement,
        sector, tech_tags, budget_ceiling, pilot_duration_days,
        risk_level, min_turnover_required, min_experience_years, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      deptAdminId,
      title,
      raw_problem_input,
      outcome_statement,
      'AgriTech',
      ['Computer Vision', 'Edge AI', 'Offline-First', 'Agronomy'],
      3500000,
      120,
      'medium',
      1500000,
      2,
      'published'
    ];
    
    const { rows: newChallenges } = await client.query(query, values);
    const challenge = newChallenges[0];
    
    console.log(`✅ Successfully created challenge in PROD: ${challenge.title} (ID: ${challenge.id})`);

  } catch (error) {
    console.error('Error creating challenge in prod:', error);
  } finally {
    await client.end();
  }
})();
