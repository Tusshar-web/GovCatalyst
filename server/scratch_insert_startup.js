require('dotenv').config();
const User = require('./src/models/userModel');
const Startup = require('./src/models/startupModel');
const { hashPassword } = require('./src/utils/authUtils');
const pool = require('./src/config/db');

(async () => {
  try {
    const passwordHash = await hashPassword('Password@123');
    
    // Create User
    const user = await User.create({
      name: 'GovTech Innovations',
      email: 'founder@govtechinnovations.com',
      password_hash: passwordHash,
      role: 'startup',
      account_status: 'active'
    });
    
    // Create Startup Profile
    const startup = await Startup.create({
      user_id: user.id,
      company_name: 'GovTech Innovations Ltd.',
      verification_status: 'unverified'
    });
    
    // Update DPIIT details (proper startup)
    await Startup.updateDpiitVerification(user.id, {
      dpiit_reg_number: 'DPIIT1234567',
      company_name: 'GovTech Innovations Ltd.',
      sector: 'AI/ML'
    });

    // Add some profile data
    await Startup.updateProfile(user.id, {
      sector: 'AI/ML',
      stage: 'Growth',
      founded_year: 2020,
      team_size: 15,
      website_url: 'https://govtechinnovations.com'
    });

    console.log('Successfully created a proper startup!');
    console.log(`Email: founder@govtechinnovations.com`);
    console.log(`Password: Password@123`);

  } catch (e) {
    console.error('Error creating startup:', e.message);
  } finally {
    process.exit(0);
  }
})();
