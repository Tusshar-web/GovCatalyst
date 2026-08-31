const Application = require('../models/applicationModel');
const Startup = require('../models/startupModel');
const Challenge = require('../models/challengeModel');
const { scoreProposalWithAI } = require('../services/aiServices');

const SHORTLIST_THRESHOLD = 75;

// 1. Startup applies to a challenge (with AI Evaluation & Gating)
exports.applyToChallenge = async (req, res) => {
  try {
    const { challenge_id } = req.params;
    const body = req.body || {};
    const proposal_summary = (
      body.proposal_summary ||
      body.proposalSummary ||
      body.proposal ||
      body.summary ||
      body.description ||
      ''
    ).toString().trim();
    
    const userId = req.user.user_id || req.user.id;

    if (!proposal_summary) {
      return res.status(400).json({ 
        success: false, 
        message: 'Proposal summary is required. Please include "proposal_summary" in the JSON body.'
      });
    }

    // 1. Verify startup profile exists
    const startup = await Startup.findByUserId(userId);
    if (!startup) {
      return res.status(400).json({ success: false, message: 'Complete your startup profile before applying.' });
    }

    // 2. Verify challenge exists and is published
    const challenge = await Challenge.findById(challenge_id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found.' });
    }
    if (challenge.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Applications are closed for this challenge.' });
    }

    // 3. Check if application already exists (allow re-submission and re-evaluation)
    const existing = await Application.findByChallengeAndStartup(challenge_id, startup.id);
    const isUpdate = !!existing;

    // 4. Run AI Evaluation Layer (Gemini)
    console.log(`Evaluating proposal with AI for startup ${startup.company_name} on challenge ${challenge.title}...`);
    const aiEvaluation = await scoreProposalWithAI({
      challenge,
      startup,
      proposal_summary
    });

    const isQualified = aiEvaluation.score >= SHORTLIST_THRESHOLD;
    const applicationStatus = isQualified ? 'shortlisted' : 'rejected';

    // 5. Create application with AI match score and qualified status
    const application = await Application.create({
      challenge_id,
      startup_id: startup.id,
      proposal_summary,
      match_score: aiEvaluation.score,
      status: applicationStatus
    });

    res.status(201).json({
      success: true,
      message: isQualified
        ? `Application submitted and SHORTLISTED! Your AI score is ${aiEvaluation.score}/100 (>= ${SHORTLIST_THRESHOLD}). It has been forwarded to the government department.`
        : `Application submitted. Your AI score is ${aiEvaluation.score}/100 (< ${SHORTLIST_THRESHOLD} threshold). The proposal did not meet the minimum criteria for shortlisting.`,
      is_qualified: isQualified,
      score: aiEvaluation.score,
      threshold: SHORTLIST_THRESHOLD,
      evaluation: {
        strengths: aiEvaluation.strengths,
        risks: aiEvaluation.risks,
        feedback: aiEvaluation.feedback_summary,
        recommendation: aiEvaluation.recommendation
      },
      application
    });
  } catch (err) {
    console.error('Error in applyToChallenge:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 2. Startup views their own submitted applications
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const startup = await Startup.findByUserId(userId);
    if (!startup) {
      return res.status(400).json({ success: false, message: 'Startup profile not found.' });
    }

    const applications = await Application.findByStartupId(startup.id);
    res.json({ success: true, count: applications.length, applications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 3. Dept Admin views applications (Defaults to only showing Qualified/Shortlisted startups >= 75)
exports.getChallengeApplications = async (req, res) => {
  try {
    const { challenge_id } = req.params;
    const showAll = req.query.all === 'true'; // pass ?all=true to see rejected/unscreened too
    const minScore = req.query.min_score ? parseFloat(req.query.min_score) : SHORTLIST_THRESHOLD;

    const applications = await Application.findByChallengeId(challenge_id, {
      min_score: minScore,
      only_qualified: !showAll
    });

    res.json({
      success: true,
      filter: showAll ? 'ALL_APPLICATIONS' : `ONLY_QUALIFIED (Score >= ${minScore})`,
      count: applications.length,
      applications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 4. Get only Approved Applications (Panel Decision)
exports.getApprovedApplications = async (req, res) => {
  try {
    const { challenge_id } = req.params;
    const applications = await Application.findApprovedByChallengeId(challenge_id);
    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
