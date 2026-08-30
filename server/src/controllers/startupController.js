const Startup = require('../models/startupModel');

async function getStartups(req, res) {
  try {
    const startups = await Startup.findAll();
    return res.json({ success: true, startups });
  } catch (err) {
    console.error('Error fetching startups:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch startups', error: err.message });
  }
}

module.exports = { getStartups };
