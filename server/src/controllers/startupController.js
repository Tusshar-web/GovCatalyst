const Startup = require('../models/startupModel');
const Challenge = require('../models/challengeModel');
const { batchScoreStartups } = require('../services/aiServices');

async function getStartups(req, res) {
  try {
    const startups = await Startup.findAll();
    return res.json({ success: true, startups });
  } catch (err) {
    console.error('Error fetching startups:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch startups', error: err.message });
  }
}

async function aiMatchStartups(req, res) {
  try {
    const { challenge_id } = req.body;
    if (!challenge_id) {
      return res.status(400).json({ success: false, message: 'challenge_id is required' });
    }

    const challenge = await Challenge.findById(challenge_id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    const startups = await Startup.findAll();
    if (startups.length === 0) {
      return res.json({ success: true, matches: [] });
    }

    const matches = await batchScoreStartups(challenge, startups);
    return res.json({ success: true, matches });
  } catch (err) {
    console.error('Error in aiMatchStartups:', err);
    return res.status(500).json({ success: false, message: 'Failed to match startups with AI', error: err.message });
  }
}

async function updateMyProfile(req, res) {
  try {
    const user_id = req.user.user_id;
    const updated = await Startup.updateProfile(user_id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Startup profile not found or no fields to update' });
    }
    return res.json({ success: true, profile: updated });
  } catch (err) {
    console.error('Error updating startup profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: err.message });
  }
}

module.exports = { getStartups, aiMatchStartups, updateMyProfile };
