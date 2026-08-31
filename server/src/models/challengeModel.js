const pool = require('../config/db');

const Challenge = {
  async create({
    dept_admin_id, title, raw_problem_input, outcome_statement,
    sector, tech_tags, budget_ceiling, pilot_duration_days,
    risk_level, min_turnover_required, min_experience_years
  }) {
    const query = `
      INSERT INTO challenges (
        dept_admin_id, title, raw_problem_input, outcome_statement,
        sector, tech_tags, budget_ceiling, pilot_duration_days,
        risk_level, min_turnover_required, min_experience_years
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `;
    const values = [
      dept_admin_id,
      title,
      raw_problem_input,
      outcome_statement,
      sector || null,
      tech_tags || [],
      budget_ceiling || null,
      pilot_duration_days || null,
      risk_level || 'medium',
      min_turnover_required || null,
      min_experience_years || null
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findAll({ status, sector } = {}) {
    let query = 'SELECT * FROM challenges WHERE 1=1';
    const values = [];
    let idx = 1;

    if (status) {
      query += ` AND status = $${idx}`;
      values.push(status);
      idx++;
    }
    if (sector) {
      query += ` AND sector = $${idx}`;
      values.push(sector);
      idx++;
    }
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, values);
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM challenges WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByDeptAdmin(dept_admin_id) {
    const { rows } = await pool.query(
      'SELECT * FROM challenges WHERE dept_admin_id = $1 ORDER BY created_at DESC',
      [dept_admin_id]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE challenges SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },

  async update(id, fields) {
    const allowed = [
      'title', 'outcome_statement', 'sector', 'tech_tags', 'budget_ceiling',
      'pilot_duration_days', 'risk_level', 'min_turnover_required', 'min_experience_years'
    ];
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

    values.push(id);
    const query = `
      UPDATE challenges SET ${setClauses.join(', ')}, updated_at = now()
      WHERE id = $${idx} RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async deleteById(id) {
    const { rowCount } = await pool.query('DELETE FROM challenges WHERE id = $1', [id]);
    return rowCount > 0;
  }
};

module.exports = Challenge;