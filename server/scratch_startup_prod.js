const { Client } = require('pg');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is installed for authUtils, but let's check authUtils.js
// Actually, let's just require the authUtils
const { hashPassword } = require('./src/utils/authUtils');
const User = require('./src/models/userModel');
const Startup = require('./src/models/startupModel');

(async () => {
  const client = new Client({
    connectionString: 'postgresql://govcatalyst_user:VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL@dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com/govbridge',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Prod DB for Startup Creation');
    
    // We must manually do inserts because User.create and Startup.create might use the local pool
    // But wait! We can just configure the pool locally by setting env vars before requiring DB!
    process.env.DB_HOST='dpg-da9hjhegekts7388aqc0-a.oregon-postgres.render.com';
    process.env.DB_USER='govcatalyst_user';
    process.env.DB_PASSWORD='VH2ZUY5z8cGllllPYY42B4hHpYMYXQtL';
    process.env.DB_NAME='govbridge';
    process.env.DB_PORT='5432';
    process.env.DB_SSL='true';
    
    // Actually, setting process.env might not work if it requires SSL true in pool config.
    // Let's just use raw queries to be safe.
    
    const passwordHash = await hashPassword('Startup@1234');
    
    // 1. Insert User
    const email = 'kisanai@example.com';
    const name = 'KisanAI Tech';
    const userQuery = `
      INSERT INTO users (name, email, password_hash, role, account_status)
      VALUES ($1, $2, $3, 'startup', 'active')
      RETURNING id, name, email
    `;
    const { rows: users } = await client.query(userQuery, [name, email, passwordHash]);
    const userId = users[0].id;
    console.log(`Created User: ${userId}`);

    // 2. Insert Startup Profile
    const companyName = 'KisanAI Solutions Pvt Ltd';
    const dpiitNumber = 'DIPP12345';
    const sector = 'AgriTech';
    const startupQuery = `
      INSERT INTO startups (
        user_id, company_name, verification_status, dpiit_reg_number, sector,
        verification_method, verified_at, stage, founded_year, team_size, past_turnover,
        tech_tags, pitch_summary, website_url
      ) VALUES (
        $1, $2, 'verified_dpiit', $3, $4,
        'dpiit_redirect', now(), 'Growth', 2021, 15, 25000000,
        $5, $6, $7
      ) RETURNING id
    `;
    
    const techTags = ['Computer Vision', 'Edge AI', 'Offline-First', 'Agronomy'];
    const pitch = 'Empowering rural farmers with on-device AI crop disease detection and real-time advisory in local languages without requiring internet access.';
    const websiteUrl = 'https://kisanai.example.com';
    
    const { rows: startups } = await client.query(startupQuery, [
      userId, companyName, dpiitNumber, sector,
      techTags, pitch, websiteUrl
    ]);
    
    console.log(`Created Startup Profile ID: ${startups[0].id}`);
    
    console.log(`
      STARTUP CREDENTIALS:
      Email: ${email}
      Password: Startup@1234
    `);

  } catch (error) {
    console.error('Error seeding startup:', error);
  } finally {
    await client.end();
  }
})();
