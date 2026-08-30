const pool = require('../config/db');

const Startup = {
  async create({ user_id, company_name, verification_status = 'unverified' }) {
    const query = `
      INSERT INTO startups (user_id, company_name, verification_status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [user_id, company_name, verification_status]);
    return rows[0];
  },

  async findByUserId(user_id) {
    const { rows } = await pool.query('SELECT * FROM startups WHERE user_id = $1', [user_id]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM startups WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async updateDpiitVerification(user_id, { dpiit_reg_number, company_name, sector }) {
    const query = `
      UPDATE startups
      SET dpiit_reg_number = $1,
          company_name = $2,
          sector = $3,
          verification_status = 'verified_dpiit',
          verification_method = 'dpiit_redirect',
          verified_at = now(),
          updated_at = now()
      WHERE user_id = $4
      RETURNING *
    `;
    const values = [dpiit_reg_number, company_name, sector, user_id];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async updateProfile(user_id, fields) {
    // fields = { sector, stage, founded_year, team_size, past_turnover, tech_tags, pitch_summary, website_url }
    const allowed = ['sector', 'stage', 'founded_year', 'team_size', 'past_turnover', 'tech_tags', 'pitch_summary', 'website_url'];
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (setClauses.length === 0) return null;

    values.push(user_id);
    const query = `
      UPDATE startups SET ${setClauses.join(', ')}, updated_at = now()
      WHERE user_id = $${idx}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM startups ORDER BY created_at DESC');
    return rows;
  }
};

module.exports = Startup;