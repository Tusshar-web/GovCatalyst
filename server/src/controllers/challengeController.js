
// POST /api/challenges  (dept_admin only)
const Challenge = require('../models/challengeModel');
const { processChallengeInput } = require('../services/aiServices');

async function createChallenge(req, res) {
  try {
    const {
      title, raw_problem_input, sector, budget_ceiling,
      pilot_duration_days, risk_level, min_turnover_required, min_experience_years
    } = req.body;

    if (!title || !raw_problem_input) {
      return res.status(400).json({ success: false, message: 'Title and problem description are required' });
    }

    // Single AI call — returns both outcome statement and tech tags
    const { outcome_statement, tech_tags } = await processChallengeInput(raw_problem_input, {
      sector,
      budget_ceiling,
    });

    const challenge = await Challenge.create({
      dept_admin_id: req.user.user_id,
      title,
      raw_problem_input,
      outcome_statement,
      sector,
      tech_tags,
      budget_ceiling,
      pilot_duration_days,
      risk_level,
      min_turnover_required,
      min_experience_years,
    });

    return res.status(201).json({ success: true, challenge });
  } catch (err) {
    console.error('Error creating challenge:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create challenge',
      error: err.message,
    });
  }
}

// ... rest of the controller (listChallenges, getChallenge, etc.) stays exactly the same
// GET /api/challenges  (all roles — list, with optional filters)
async function listChallenges(req, res) {
  try {
    const { status, sector } = req.query;
    const challenges = await Challenge.findAll({ status, sector });
    return res.json({ success: true, challenges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
  }
}

// GET /api/challenges/:id
async function getChallenge(req, res) {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    return res.json({ success: true, challenge });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to fetch challenge' });
  }
}

// GET /api/challenges/my  (dept_admin — their own challenges)
async function getMyChallenges(req, res) {
  try {
    const challenges = await Challenge.findByDeptAdmin(req.user.user_id);
    return res.json({ success: true, challenges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to fetch your challenges' });
  }
}

// PATCH /api/challenges/:id  (dept_admin only — edit fields)
async function updateChallenge(req, res) {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    if (challenge.dept_admin_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You do not own this challenge' });
    }

    const updated = await Challenge.update(req.params.id, req.body);
    return res.json({ success: true, challenge: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to update challenge' });
  }
}

// PATCH /api/challenges/:id/publish  (dept_admin only — draft -> published)
async function publishChallenge(req, res) {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    if (challenge.dept_admin_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You do not own this challenge' });
    }
    if (challenge.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft challenges can be published' });
    }

    const updated = await Challenge.updateStatus(req.params.id, 'published');
    return res.json({ success: true, challenge: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to publish challenge' });
  }
}

// POST /api/challenges/ai-draft  (dept_admin only)
async function draftWithAI(req, res) {
  try {
    const { raw_problem_input, sector, budget_ceiling } = req.body;
    if (!raw_problem_input) {
      return res.status(400).json({ success: false, message: 'Problem description is required' });
    }

    const aiResult = await processChallengeInput(raw_problem_input, { sector, budget_ceiling });
    return res.json({ success: true, ai_draft: aiResult });
  } catch (err) {
    console.error('draftWithAI error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate AI draft' });
  }
}

// DELETE /api/challenges/:id
async function deleteChallenge(req, res) {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    // Only allow owner or super_admin
    if (req.user.role !== 'super_admin' && challenge.dept_admin_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You do not own this challenge' });
    }

    if (challenge.status === 'published') {
      return res.status(400).json({ success: false, message: 'Cannot delete a published challenge' });
    }

    const deleted = await Challenge.deleteById(req.params.id);
    if (!deleted) {
      return res.status(500).json({ success: false, message: 'Failed to delete challenge' });
    }

    return res.json({ success: true, message: 'Challenge deleted successfully' });
  } catch (err) {
    console.error('deleteChallenge error:', err);
    return res.status(500).json({ success: false, message: 'Error deleting challenge' });
  }
}

module.exports = {
  createChallenge,
  listChallenges,
  getChallenge,
  getMyChallenges,
  updateChallenge,
  publishChallenge,
  draftWithAI,
  deleteChallenge,
};