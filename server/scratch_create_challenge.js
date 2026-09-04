require('dotenv').config();
const User = require('./src/models/userModel');
const Challenge = require('./src/models/challengeModel');
const pool = require('./src/config/db');

(async () => {
  try {
    console.log('--- Creating a High-Quality Challenge ---');

    // 1. Get Dept Admin
    const deptAdmin = await User.findByEmail('dept_admin@example.com');
    if (!deptAdmin) {
      console.error('Dept Admin not found. Run seed script first.');
      process.exit(1);
    }

    const title = 'AI-Powered Crop Disease Prediction & Real-time Advisory for Rural Farmers';
    const raw_problem_input = 'Farmers in rural Maharashtra are facing massive crop losses due to unseasonal rains and sudden pest attacks. They do not have access to agronomists and spray pesticides blindly, which ruins the soil. We need an app where a farmer can click a photo of a diseased leaf without internet, and the system tells them exactly what disease it is and what organic/chemical spray to use, in Marathi. It should work on low-end smartphones.';
    
    const outcome_statement = 'The solution must accurately identify at least 15 common diseases in Soybean and Cotton crops from mobile photos with >90% precision. It must operate entirely offline (on-device inference) on smartphones with 2GB RAM or less. The advisory output must be localized in Marathi and must reduce indiscriminate pesticide usage by 30% among the pilot user group (500 farmers) over one crop cycle.';
    
    const challenge = await Challenge.create({
      dept_admin_id: deptAdmin.user_id,
      title,
      raw_problem_input,
      outcome_statement,
      sector: 'AgriTech',
      tech_tags: ['Computer Vision', 'Edge AI', 'Offline-First', 'Agronomy'],
      budget_ceiling: 3500000,
      pilot_duration_days: 120,
      risk_level: 'medium',
      min_turnover_required: 1500000,
      min_experience_years: 2
    });

    // Update the challenge status to published
    await pool.query('UPDATE challenges SET status = $1 WHERE id = $2', ['published', challenge.id]);
    
    console.log(`✅ Successfully created challenge: ${challenge.title} (ID: ${challenge.id})`);

  } catch (error) {
    console.error('Error creating challenge:', error);
  } finally {
    pool.end();
  }
})();
