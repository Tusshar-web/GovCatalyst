/**
 * GovCatalyst — Pilot DB Model
 * Raw-SQL pg-pool queries (consistent with applicationModel / challengeModel pattern)
 * Tables: gov_pilots, gov_pilot_kpis, gov_pilot_risks, gov_pilot_issues,
 *         gov_pilot_feedbacks, gov_pilot_evidences, gov_pilot_audit_logs
 *
 * NOTE: We use "gov_pilots" prefix to co-exist with the existing slim `pilots`
 *       linking table (pilots.id is UUID tied to applications).
 */

const pool = require('../config/db');

// ─────────────────────────────────────────
// PILOTS
// ─────────────────────────────────────────
const Pilot = {
  /** Insert a new gov_pilot row and return it */
  async create({
    pilotCode, name, problemStatementText, department, startup, startupLead,
    solution, objective, baselineObjective, targetObjective, minAcceptableResult,
    successCondition, location, startDate, endDate, durationWeeks, usersCount,
    scopeIncluded, scopeExcluded, budgetAllocated, pilotOwner,
    cyberChecklist, dataRules, ipRules
  }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilots (
        pilot_code, name, problem_statement_text, department, startup, startup_lead,
        solution, objective, baseline_objective, target_objective,
        min_acceptable_result, success_condition, location,
        start_date, end_date, duration_weeks, users_count,
        scope_included, scope_excluded, budget_allocated, budget_spent,
        pilot_owner, status, outcome, committee_decision,
        cyber_checklist, data_rules, ip_rules
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        0,$21,'DRAFT','PENDING','PENDING',$22,$23,$24
      ) RETURNING *`,
      [
        pilotCode, name, problemStatementText, department, startup, startupLead,
        solution, objective, baselineObjective, targetObjective,
        minAcceptableResult, successCondition, location,
        startDate, endDate, durationWeeks || 8, usersCount || 10,
        JSON.stringify(scopeIncluded || []),
        JSON.stringify(scopeExcluded || []),
        budgetAllocated || 0,
        pilotOwner,
        JSON.stringify(cyberChecklist || []),
        JSON.stringify(dataRules || {}),
        JSON.stringify(ipRules || {}),
      ]
    );
    return rows[0];
  },

  /** Fetch all pilots, newest first */
  async findAll() {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilots ORDER BY created_at DESC'
    );
    return rows;
  },

  /** Fetch pilots belonging to a specific startup (case-insensitive name match) */
  async findByStartupName(companyName) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilots WHERE LOWER(startup) = LOWER($1) ORDER BY created_at DESC',
      [companyName]
    );
    return rows;
  },

  /** Fetch one pilot by UUID */
  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilots WHERE id = $1', [id]
    );
    return rows[0] || null;
  },

  /** Fetch by human-readable pilot_code */
  async findByCode(pilotCode) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilots WHERE pilot_code = $1', [pilotCode]
    );
    return rows[0] || null;
  },

  /** Update pilot status and return the updated row */
  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE gov_pilots SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },

  /** Update outcome, committee decision, and reason */
  async updateOutcome(id, outcome, committeeDecision, committeeReason) {
    const { rows } = await pool.query(
      `UPDATE gov_pilots
       SET outcome = $1, committee_decision = $2, committee_reason = $3, updated_at = now()
       WHERE id = $4 RETURNING *`,
      [outcome, committeeDecision || 'PENDING', committeeReason || null, id]
    );
    return rows[0];
  },

  /** Generic field update (allow-list) */
  async update(id, fields) {
    const colMap = {
      name: 'name',
      problemStatementText: 'problem_statement_text',
      department: 'department',
      startup: 'startup',
      startupLead: 'startup_lead',
      solution: 'solution',
      objective: 'objective',
      baselineObjective: 'baseline_objective',
      targetObjective: 'target_objective',
      minAcceptableResult: 'min_acceptable_result',
      successCondition: 'success_condition',
      location: 'location',
      startDate: 'start_date',
      endDate: 'end_date',
      durationWeeks: 'duration_weeks',
      usersCount: 'users_count',
      scopeIncluded: 'scope_included',
      scopeExcluded: 'scope_excluded',
      budgetAllocated: 'budget_allocated',
      budgetSpent: 'budget_spent',
      pilotOwner: 'pilot_owner',
      securityStatus: 'security_status',
      cyberChecklist: 'cyber_checklist',
      dataRules: 'data_rules',
      ipRules: 'ip_rules',
      committeeRecommendation: 'committee_recommendation',
    };

    const setClauses = [];
    const values    = [];
    let idx = 1;

    for (const [jsKey, col] of Object.entries(colMap)) {
      if (fields[jsKey] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        values.push(typeof fields[jsKey] === 'object' ? JSON.stringify(fields[jsKey]) : fields[jsKey]);
        idx++;
      }
    }
    if (setClauses.length === 0) return null;

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE gov_pilots SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// PILOT KPIs
// ─────────────────────────────────────────
const PilotKpi = {
  async create({ pilotId, kpiCode, name, category, direction, unit, baseline, target, minAcceptable, current }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_kpis
        (pilot_id, kpi_code, name, category, direction, unit, baseline, target, min_acceptable, current, improvement_percent, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'PENDING') RETURNING *`,
      [
        pilotId, kpiCode, name,
        category  || 'Efficiency',
        direction || 'LOWER_IS_BETTER',
        unit      || '',
        baseline, target, minAcceptable,
        current   ?? baseline
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_kpis WHERE pilot_id = $1 ORDER BY kpi_code', [pilotId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_kpis WHERE id = $1', [id]
    );
    return rows[0] || null;
  },

  async update(id, { current, improvementPercent, status }) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_kpis
       SET current = COALESCE($1, current),
           improvement_percent = COALESCE($2, improvement_percent),
           status = COALESCE($3, status),
           updated_at = now()
       WHERE id = $4 RETURNING *`,
      [current, improvementPercent, status, id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// PILOT RISKS
// ─────────────────────────────────────────
const PilotRisk = {
  async create({ pilotId, riskCode, category, description, probability, impact, level, mitigation, owner }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_risks
        (pilot_id, risk_code, category, description, probability, impact, level, mitigation, owner, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Open') RETURNING *`,
      [
        pilotId, riskCode, category, description,
        probability || 'Low', impact || 'Low', level || 'Low',
        mitigation, owner
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_risks WHERE pilot_id = $1 ORDER BY risk_code', [pilotId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_risks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// PILOT ISSUES
// ─────────────────────────────────────────
const PilotIssue = {
  async create({ pilotId, issueCode, reportedBy, category, description, severity, assignedTo }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_issues
        (pilot_id, issue_code, reported_by, category, description, severity, assigned_to, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Open') RETURNING *`,
      [
        pilotId, issueCode, reportedBy,
        category || 'Technical', description,
        severity || 'Low', assignedTo || null
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_issues WHERE pilot_id = $1 ORDER BY created_at DESC', [pilotId]
    );
    return rows;
  },

  async resolve(id, { resolution, status }) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_issues SET resolution = $1, status = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [resolution, status || 'Resolved', id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// PILOT FEEDBACK
// ─────────────────────────────────────────
const PilotFeedback = {
  async create({ pilotId, userName, userRole, easeOfUse, performance, reliability, accuracy, overallSatisfaction, comments }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_feedbacks
        (pilot_id, user_name, user_role, ease_of_use, performance, reliability, accuracy, overall_satisfaction, comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        pilotId, userName, userRole || 'Govt Engineer',
        easeOfUse, performance, reliability, accuracy,
        overallSatisfaction, comments || null
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_feedbacks WHERE pilot_id = $1 ORDER BY created_at DESC', [pilotId]
    );
    return rows;
  },

  async averageByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT AVG(overall_satisfaction)::numeric(4,2) AS avg_satisfaction,
              COUNT(*) AS response_count
       FROM gov_pilot_feedbacks WHERE pilot_id = $1`,
      [pilotId]
    );
    return {
      avgSatisfaction: parseFloat(rows[0]?.avg_satisfaction || 0),
      responseCount:   parseInt(rows[0]?.response_count    || 0),
    };
  }
};

// ─────────────────────────────────────────
// PILOT EVIDENCE
// ─────────────────────────────────────────
const PilotEvidence = {
  async create({ pilotId, evidenceCode, name, documentType, fileUrl, uploadedBy, uploadDate, relatedMilestone }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_evidences
        (pilot_id, evidence_code, name, document_type, file_url, uploaded_by, upload_date, related_milestone, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending') RETURNING *`,
      [
        pilotId, evidenceCode, name, documentType,
        fileUrl || null, uploadedBy,
        uploadDate || new Date().toISOString().substring(0, 10),
        relatedMilestone || null
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_evidences WHERE pilot_id = $1 ORDER BY upload_date DESC', [pilotId]
    );
    return rows;
  },

  async verify(id, status) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_evidences SET verification_status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// AUDIT LOG (persisted to DB)
// ─────────────────────────────────────────
const PilotAuditLog = {
  async log({ pilotId, userId, action, detail, oldValue, newValue }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_audit_logs (pilot_id, user_id, action, detail, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        pilotId || null, userId || null,
        action, detail,
        String(oldValue ?? 'N/A'), String(newValue ?? 'N/A')
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_audit_logs WHERE pilot_id = $1 ORDER BY created_at DESC',
      [pilotId]
    );
    return rows;
  }
};

// ─────────────────────────────────────────
// PILOT TELEMETRY READINGS (Data Source Provenance)
// ─────────────────────────────────────────
const PilotTelemetry = {
  async record({ pilotId, kpiId, value, sourceType, sourceReference, provenanceMetadata, recordedAt }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_kpi_telemetry_readings
        (pilot_id, kpi_id, value, source_type, source_reference, provenance_metadata, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
       RETURNING *`,
      [
        pilotId, kpiId, value,
        sourceType || 'MANUAL',
        sourceReference || 'System Input',
        JSON.stringify(provenanceMetadata || {}),
        recordedAt || new Date().toISOString()
      ]
    );
    return rows[0];
  },

  async recordBatch(pilotId, readings) {
    if (!Array.isArray(readings) || readings.length === 0) return [];
    const inserted = [];
    for (const r of readings) {
      const res = await this.record({
        pilotId,
        kpiId: r.kpiId,
        value: r.value,
        sourceType: r.sourceType,
        sourceReference: r.sourceReference,
        provenanceMetadata: r.provenanceMetadata,
        recordedAt: r.recordedAt
      });
      inserted.push(res);
    }
    return inserted;
  },

  async findByPilot(pilotId, limit = 100) {
    const { rows } = await pool.query(
      `SELECT t.*, k.name as kpi_name, k.kpi_code, k.unit
       FROM gov_kpi_telemetry_readings t
       JOIN gov_pilot_kpis k ON t.kpi_id = k.id
       WHERE t.pilot_id = $1
       ORDER BY t.recorded_at DESC
       LIMIT $2`,
      [pilotId, limit]
    );
    return rows;
  },

  async findByKpi(kpiId, limit = 50) {
    const { rows } = await pool.query(
      `SELECT * FROM gov_kpi_telemetry_readings
       WHERE kpi_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [kpiId, limit]
    );
    return rows;
  }
};

// ─────────────────────────────────────────
// PILOT ALERTS (Real-Time Threshold Breaches)
// ─────────────────────────────────────────
const PilotAlert = {
  async create({ pilotId, kpiId, severity, title, message, expectedValue, actualValue, variancePct, recipientRole }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_alerts
        (pilot_id, kpi_id, severity, title, message, expected_value, actual_value, variance_pct, recipient_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
       RETURNING *`,
      [
        pilotId, kpiId || null,
        severity || 'WARNING',
        title, message,
        expectedValue || null,
        actualValue || null,
        variancePct || null,
        recipientRole || 'ALL'
      ]
    );
    return rows[0];
  },

  async findByPilot(pilotId, status = null) {
    let query = `SELECT a.*, k.name as kpi_name, k.kpi_code
                 FROM gov_pilot_alerts a
                 LEFT JOIN gov_pilot_kpis k ON a.kpi_id = k.id
                 WHERE a.pilot_id = $1`;
    const params = [pilotId];

    if (status) {
      query += ` AND a.status = $2`;
      params.push(status);
    }
    query += ` ORDER BY a.created_at DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  },

  async acknowledge(id, acknowledgedBy) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_alerts
       SET status = 'ACKNOWLEDGED', acknowledged_by = $1, acknowledged_at = now()
       WHERE id = $2
       RETURNING *`,
      [acknowledgedBy || 'Authorized User', id]
    );
    return rows[0];
  },

  async resolve(id) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_alerts
       SET status = 'RESOLVED'
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────
const PilotMilestone = {
  async create({ pilotId, milestoneCode, phase, name, description, dueDate, paymentAmount, paymentLinked }) {
    const { rows } = await pool.query(
      `INSERT INTO gov_pilot_milestones (
        pilot_id, milestone_code, phase, name, description, due_date, payment_amount, payment_linked, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
      RETURNING *`,
      [pilotId, milestoneCode, phase || 1, name, description, dueDate, paymentAmount || 0, paymentLinked !== false]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      'SELECT * FROM gov_pilot_milestones WHERE pilot_id = $1 ORDER BY due_date ASC',
      [pilotId]
    );
    return rows;
  },

  async updateStatus(id, status, completedDate = null) {
    const { rows } = await pool.query(
      `UPDATE gov_pilot_milestones 
       SET status = $1, completed_date = COALESCE($2, completed_date), updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, completedDate, id]
    );
    return rows[0];
  },

  async deleteByPilot(pilotId) {
    await pool.query(
      'DELETE FROM gov_pilot_milestones WHERE pilot_id = $1',
      [pilotId]
    );
  }
};

module.exports = {
  Pilot,
  PilotKpi,
  PilotRisk,
  PilotIssue,
  PilotFeedback,
  PilotEvidence,
  PilotAuditLog,
  PilotTelemetry,
  PilotAlert,
  PilotMilestone
};
