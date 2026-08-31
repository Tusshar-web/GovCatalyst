require('dotenv').config();
const User = require('./src/models/userModel');
const Startup = require('./src/models/startupModel');
const Challenge = require('./src/models/challengeModel');
const Application = require('./src/models/applicationModel');
const { EvaluationCriteria, EvaluationAssignment } = require('./src/models/evaluation.db');
const { hashPassword } = require('./src/utils/authUtils');
const pool = require('./src/config/db');

(async () => {
  try {
    console.log('--- Starting Flow Seeding ---');
    const passwordHash = await hashPassword('Password@123');

    // 1. Get or Create Dept Admin
    let deptAdmin = await User.findByEmail('dept_admin@example.com');
    if (!deptAdmin) {
      deptAdmin = await User.create({
        name: 'Shri Rajesh Verma',
        email: 'dept_admin@example.com',
        password_hash: passwordHash,
        role: 'dept_admin',
        department_name: 'IT Department',
        account_status: 'active'
      });
      console.log('Created Dept Admin');
    }

    // 2. Get or Create Evaluator
    let evaluator = await User.findByEmail('evaluator@example.com');
    if (!evaluator) {
      evaluator = await User.create({
        name: 'Dr. Expert Reviewer',
        email: 'evaluator@example.com',
        password_hash: passwordHash,
        role: 'evaluator',
        department_name: 'Tech Review Board',
        account_status: 'active'
      });
      console.log('Created Evaluator');
    }

    // 3. Get Startup
    let startupUser = await User.findByEmail('founder@govtechinnovations.com');
    if (!startupUser) {
      startupUser = await User.create({
        name: 'GovTech Innovations',
        email: 'founder@govtechinnovations.com',
        password_hash: passwordHash,
        role: 'startup',
        account_status: 'active'
      });
      await Startup.create({
        user_id: startupUser.id,
        company_name: 'GovTech Innovations Ltd.',
        verification_status: 'verified_dpiit'
      });
      console.log('Created Startup');
    }
    const startupInfo = await Startup.findByUserId(startupUser.id);

    // 4. Create Challenge
    const challenge = await Challenge.create({
      dept_admin_id: deptAdmin.id,
      title: 'AI for Traffic Management',
      raw_problem_input: 'We need to optimize traffic light timings based on real-time camera feeds to reduce congestion in Mumbai.',
      outcome_statement: 'Reduce average wait times at intersections by 20%.',
      sector: 'AI/ML',
      tech_tags: ['AI', 'Computer Vision', 'IoT'],
      budget_ceiling: 5000000,
      pilot_duration_days: 90,
      risk_level: 'medium',
      min_turnover_required: 1000000,
      min_experience_years: 2
    });
    // Set challenge to published
    await Challenge.updateStatus(challenge.id, 'published');
    console.log(`Created Challenge: ${challenge.id}`);

    // 5. Seed Criteria
    await EvaluationCriteria.seedDefaults(challenge.id);
    console.log('Seeded Evaluation Criteria');

    // 6. Startup Applies for Challenge
    const application = await Application.create({
      challenge_id: challenge.id,
      startup_id: startupInfo.id,
      proposal_summary: 'We propose an edge-AI computer vision system that dynamically alters traffic signals based on queue lengths.',
      match_score: 92, // AI pre-screening score mock
      status: 'shortlisted'
    });
    console.log(`Created Application: ${application.id}`);

    // 7. Assign Evaluator
    await EvaluationAssignment.create({
      applicationId: application.id,
      evaluatorId: evaluator.id,
      assignedBy: deptAdmin.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });
    console.log('Assigned Evaluator to Application');

    console.log('\n--- Flow Seeding Complete! ---');
    console.log(`Dept Admin: ${deptAdmin.email}`);
    console.log(`Evaluator: ${evaluator.email}`);
    console.log(`Startup: ${startupUser.email}`);
    console.log(`Challenge Title: ${challenge.title}`);
    console.log('Password for all accounts is: Password@123');

  } catch (e) {
    console.error('Error in flow:', e);
  } finally {
    process.exit(0);
  }
})();
