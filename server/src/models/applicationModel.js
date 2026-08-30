const pool = require('../config/db');

const Application = {
  async create({ challenge_id, startup_id, proposal_summary, match_score = null, status = 'submitted' }) {
    const query = `
      INSERT INTO applications (challenge_id, startup_id, proposal_summary, match_score, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (challenge_id, startup_id) 
      DO UPDATE SET 
        proposal_summary = EXCLUDED.proposal_summary,
        match_score = EXCLUDED.match_score,
        status = EXCLUDED.status,
        updated_at = now()
      RETURNING *
    `;
    const { rows } = await pool.query(query, [challenge_id, startup_id, proposal_summary, match_score, status]);
    return rows[0];
  },

  async updateEvaluation(id, { match_score, status }) {
    const query = `
      UPDATE applications
      SET match_score = $1, status = $2, updated_at = now()
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [match_score, status, id]);
    return rows[0];
  },

  async findByChallengeAndStartup(challenge_id, startup_id) {
    const { rows } = await pool.query(
      'SELECT * FROM applications WHERE challenge_id = $1 AND startup_id = $2',
      [challenge_id, startup_id]
    );
    return rows[0] || null;
  },

  async findByStartupId(startup_id) {
    const query = `
      SELECT a.*, c.title as challenge_title, c.sector, c.budget_ceiling
      FROM applications a
      JOIN challenges c ON a.challenge_id = c.id
      WHERE a.startup_id = $1
      ORDER BY a.created_at DESC
    `;
    const { rows } = await pool.query(query, [startup_id]);
    return rows;
  },

  async findByChallengeId(challenge_id, { min_score = 75, only_qualified = false } = {}) {
    let query = `
      SELECT a.*, s.company_name, s.sector, s.stage, s.dpiit_reg_number, s.tech_tags as startup_tags
      FROM applications a
      JOIN startups s ON a.startup_id = s.id
      WHERE a.challenge_id = $1
    `;
    const values = [challenge_id];
    let idx = 2;

    if (only_qualified) {
      query += ` AND (a.match_score >= $${idx} OR a.status = 'shortlisted')`;
      values.push(min_score);
      idx++;
    }

    query += ' ORDER BY a.match_score DESC NULLS LAST, a.created_at DESC';
    const { rows } = await pool.query(query, values);
    return rows;
  },

  async findApprovedByChallengeId(challenge_id) {
    const query = `
      SELECT a.*, s.company_name, s.sector, s.stage, s.dpiit_reg_number, s.tech_tags as startup_tags,
             ep.panel_recommendation, ep.avg_weighted_score
      FROM applications a
      JOIN startups s ON a.startup_id = s.id
      JOIN evaluation_panel_decisions ep ON ep.application_id = a.id
      WHERE a.challenge_id = $1 
        AND ep.panel_recommendation IN ('APPROVE', 'CONDITIONAL')
      ORDER BY ep.avg_weighted_score DESC
    `;
    const { rows } = await pool.query(query, [challenge_id]);
    return rows;
  }
};

module.exports = Application;
