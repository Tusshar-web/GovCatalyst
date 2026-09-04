/**
 * GovCatalyst — Independent Validation DB Model
 * Raw pg-pool queries for the validator workflow.
 *
 * Tables:
 *   validator_assignments    — maps validator → gov_pilot
 *   milestone_verifications  — per-milestone sign-off
 *   kpi_validations          — per-KPI attestation with discrepancy calc
 *   validation_reports       — composite final report (4 dimension scores)
 *   validation_objections    — dept_admin can object to a report
 */

const pool = require('../config/db');

// ─────────────────────────────────────────
// VALIDATOR ASSIGNMENTS
// ─────────────────────────────────────────
const ValidatorAssignment = {
  async create({ pilotId, validatorId, assignedBy, scope, dueDate }) {
    const { rows } = await pool.query(
      `INSERT INTO validator_assignments
         (pilot_id, validator_id, assigned_by, scope, due_date, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (pilot_id, validator_id) DO UPDATE
         SET scope = EXCLUDED.scope,
             due_date = EXCLUDED.due_date,
             status = 'pending',
             assigned_at = now()
       RETURNING *`,
      [pilotId, validatorId, assignedBy, scope || null, dueDate || null]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT va.*,
              u.name        AS validator_name,
              u.email       AS validator_email,
              u.designation AS validator_designation
       FROM validator_assignments va
       JOIN users u ON va.validator_id = u.id
       WHERE va.pilot_id = $1
       ORDER BY va.assigned_at`,
      [pilotId]
    );
    return rows;
  },

  async findByValidator(validatorId) {
    const { rows } = await pool.query(
      `SELECT va.*,
              gp.name           AS pilot_name,
              gp.pilot_code,
              gp.department,
              gp.startup,
              gp.status         AS pilot_status,
              gp.start_date,
              gp.end_date
       FROM validator_assignments va
       JOIN gov_pilots gp ON va.pilot_id = gp.id
       WHERE va.validator_id = $1
       ORDER BY va.due_date NULLS LAST, va.assigned_at`,
      [validatorId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT va.*, u.name AS validator_name, u.email AS validator_email
       FROM validator_assignments va
       JOIN users u ON va.validator_id = u.id
       WHERE va.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findAllAssignments() {
    const { rows } = await pool.query(
      `SELECT va.*, 
              u.name AS validator_name, 
              u.email AS validator_email,
              gp.pilot_code AS pilot_code
       FROM validator_assignments va
       JOIN users u ON va.validator_id = u.id
       JOIN gov_pilots gp ON va.pilot_id = gp.id
       ORDER BY va.assigned_at DESC`
    );
    return rows;
  },

  async activate(id) {
    const { rows } = await pool.query(
      `UPDATE validator_assignments SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async complete(id) {
    const { rows } = await pool.query(
      `UPDATE validator_assignments
       SET status = 'completed', completed_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  },

  async withdraw(id) {
    const { rows } = await pool.query(
      `UPDATE validator_assignments SET status = 'withdrawn' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// MILESTONE VERIFICATIONS
// ─────────────────────────────────────────
const MilestoneVerification = {
  async create({ assignmentId, pilotId, validatorId, milestoneRef, claimedKpiActual, evidenceIds }) {
    const { rows } = await pool.query(
      `INSERT INTO milestone_verifications
         (assignment_id, pilot_id, validator_id, milestone_ref,
          claimed_kpi_actual, evidence_ids, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        assignmentId, pilotId, validatorId, milestoneRef,
        claimedKpiActual || null,
        JSON.stringify(evidenceIds || [])
      ]
    );
    return rows[0];
  },

  async verify({ id, verifiedKpiActual, verificationStatus, notes }) {
    const { rows } = await pool.query(
      `UPDATE milestone_verifications
       SET verified_kpi_actual   = $1,
           verification_status   = $2,
           notes                 = $3,
           verified_at           = now(),
           updated_at            = now()
       WHERE id = $4 RETURNING *`,
      [verifiedKpiActual || null, verificationStatus, notes || null, id]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT mv.*, u.name AS validator_name
       FROM milestone_verifications mv
       JOIN users u ON mv.validator_id = u.id
       WHERE mv.pilot_id = $1
       ORDER BY mv.created_at`,
      [pilotId]
    );
    return rows;
  },

  async findByAssignment(assignmentId) {
    const { rows } = await pool.query(
      `SELECT * FROM milestone_verifications WHERE assignment_id = $1 ORDER BY created_at`,
      [assignmentId]
    );
    return rows;
  },

  async summaryByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                                    AS total,
         COUNT(*) FILTER (WHERE verification_status = 'verified')   AS verified,
         COUNT(*) FILTER (WHERE verification_status = 'partially_verified') AS partial,
         COUNT(*) FILTER (WHERE verification_status = 'failed')     AS failed,
         COUNT(*) FILTER (WHERE verification_status = 'pending')    AS pending
       FROM milestone_verifications WHERE pilot_id = $1`,
      [pilotId]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// KPI VALIDATIONS
// ─────────────────────────────────────────
const KpiValidation = {
  async create({ assignmentId, pilotId, kpiId, validatorId, claimedValue, dataSources }) {
    const { rows } = await pool.query(
      `INSERT INTO kpi_validations
         (assignment_id, pilot_id, kpi_id, validator_id, claimed_value, data_sources, verdict)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (assignment_id, kpi_id) DO UPDATE
         SET claimed_value = EXCLUDED.claimed_value,
             data_sources  = EXCLUDED.data_sources,
             verdict       = 'pending'
       RETURNING *`,
      [assignmentId, pilotId, kpiId, validatorId, claimedValue, dataSources || null]
    );
    return rows[0];
  },

  /** Validator submits their finding for one KPI */
  async validate({ id, verifiedValue, dataSources, verdict, notes }) {
    // Fetch claimed to compute discrepancy
    const { rows: existing } = await pool.query(
      'SELECT claimed_value FROM kpi_validations WHERE id = $1', [id]
    );
    const claimed = parseFloat(existing[0]?.claimed_value || 0);
    const verified = parseFloat(verifiedValue);
    const discrepancy = claimed !== 0
      ? parseFloat(((Math.abs(claimed - verified) / claimed) * 100).toFixed(2))
      : 0;

    const { rows } = await pool.query(
      `UPDATE kpi_validations
       SET verified_value    = $1,
           discrepancy_pct   = $2,
           data_sources      = COALESCE($3, data_sources),
           verdict           = $4,
           notes             = $5,
           validated_at      = now()
       WHERE id = $6 RETURNING *`,
      [verifiedValue, discrepancy, dataSources, verdict, notes || null, id]
    );
    return rows[0];
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT kv.*,
              gk.name      AS kpi_name,
              gk.unit,
              gk.direction,
              gk.target,
              gk.baseline,
              u.name       AS validator_name
       FROM kpi_validations kv
       JOIN gov_pilot_kpis gk ON kv.kpi_id       = gk.id
       JOIN users           u ON kv.validator_id  = u.id
       WHERE kv.pilot_id = $1
       ORDER BY gk.kpi_code`,
      [pilotId]
    );
    return rows;
  },

  async findByAssignment(assignmentId) {
    const { rows } = await pool.query(
      `SELECT kv.*, gk.name AS kpi_name, gk.unit, gk.target, gk.baseline
       FROM kpi_validations kv
       JOIN gov_pilot_kpis gk ON kv.kpi_id = gk.id
       WHERE kv.assignment_id = $1 ORDER BY gk.kpi_code`,
      [assignmentId]
    );
    return rows;
  },

  /** Summary stats — average discrepancy, disputed count */
  async summaryByAssignment(assignmentId) {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                              AS total_kpis,
         COUNT(*) FILTER (WHERE verdict = 'confirmed')        AS confirmed,
         COUNT(*) FILTER (WHERE verdict = 'adjusted')         AS adjusted,
         COUNT(*) FILTER (WHERE verdict = 'disputed')         AS disputed,
         COUNT(*) FILTER (WHERE verdict = 'pending')          AS pending,
         ROUND(AVG(discrepancy_pct)::numeric, 2)             AS avg_discrepancy_pct
       FROM kpi_validations WHERE assignment_id = $1`,
      [assignmentId]
    );
    return rows[0];
  }
};

// ─────────────────────────────────────────
// VALIDATION REPORTS
// ─────────────────────────────────────────
const ValidationReport = {
  /**
   * Create or update a draft report.
   * Composite score = weighted avg of the 4 dimension scores.
   * Thresholds: ≥ 80 → PASS | ≥ 60 → CONDITIONAL_PASS | < 60 → FAIL
   */
  async upsert({
    assignmentId, pilotId, validatorId,
    kpiAchievementScore, dataIntegrityScore,
    processComplianceScore, stakeholderFeedbackScore,
    executiveSummary, keyFindings, deviationsNoted, recommendations,
    readyForProcurement, readyForScale, clearanceConditions
  }) {
    // Weighted composite: KPI 40%, data 25%, process 20%, stakeholder 15%
    const composite = parseFloat((
      (kpiAchievementScore    * 0.40) +
      (dataIntegrityScore     * 0.25) +
      (processComplianceScore * 0.20) +
      (stakeholderFeedbackScore * 0.15)
    ).toFixed(2));

    let verdict = 'FAIL';
    if (composite >= 80) verdict = 'PASS';
    else if (composite >= 60) verdict = 'CONDITIONAL_PASS';

    const { rows } = await pool.query(
      `INSERT INTO validation_reports (
         assignment_id, pilot_id, validator_id,
         overall_verdict, kpi_achievement_score, data_integrity_score,
         process_compliance_score, stakeholder_feedback_score, composite_score,
         executive_summary, key_findings, deviations_noted, recommendations,
         ready_for_procurement, ready_for_scale, clearance_conditions
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (assignment_id) DO UPDATE SET
         overall_verdict             = EXCLUDED.overall_verdict,
         kpi_achievement_score       = EXCLUDED.kpi_achievement_score,
         data_integrity_score        = EXCLUDED.data_integrity_score,
         process_compliance_score    = EXCLUDED.process_compliance_score,
         stakeholder_feedback_score  = EXCLUDED.stakeholder_feedback_score,
         composite_score             = EXCLUDED.composite_score,
         executive_summary           = EXCLUDED.executive_summary,
         key_findings                = EXCLUDED.key_findings,
         deviations_noted            = EXCLUDED.deviations_noted,
         recommendations             = EXCLUDED.recommendations,
         ready_for_procurement       = EXCLUDED.ready_for_procurement,
         ready_for_scale             = EXCLUDED.ready_for_scale,
         clearance_conditions        = EXCLUDED.clearance_conditions,
         updated_at                  = now()
       RETURNING *`,
      [
        assignmentId, pilotId, validatorId,
        verdict,
        kpiAchievementScore, dataIntegrityScore,
        processComplianceScore, stakeholderFeedbackScore,
        composite,
        executiveSummary || null, keyFindings || null,
        deviationsNoted || null, recommendations || null,
        readyForProcurement || false,
        readyForScale || false,
        clearanceConditions || null
      ]
    );
    return rows[0];
  },

  /** Officially submit the report (locks it) */
  async submit(assignmentId) {
    const { rows } = await pool.query(
      `UPDATE validation_reports
       SET submitted_at = now(), updated_at = now()
       WHERE assignment_id = $1 AND submitted_at IS NULL
       RETURNING *`,
      [assignmentId]
    );
    return rows[0];
  },

  async findByAssignment(assignmentId) {
    const { rows } = await pool.query(
      `SELECT vr.*, u.name AS validator_name
       FROM validation_reports vr
       JOIN users u ON vr.validator_id = u.id
       WHERE vr.assignment_id = $1`,
      [assignmentId]
    );
    return rows[0] || null;
  },

  async findByPilot(pilotId) {
    const { rows } = await pool.query(
      `SELECT vr.*, u.name AS validator_name, u.email AS validator_email
       FROM validation_reports vr
       JOIN users u ON vr.validator_id = u.id
       WHERE vr.pilot_id = $1
       ORDER BY vr.submitted_at DESC NULLS LAST`,
      [pilotId]
    );
    return rows;
  }
};

// ─────────────────────────────────────────
// VALIDATION OBJECTIONS
// ─────────────────────────────────────────
const ValidationObjection = {
  async create({ reportId, pilotId, raisedBy, reason }) {
    const { rows } = await pool.query(
      `INSERT INTO validation_objections (report_id, pilot_id, raised_by, reason, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
      [reportId, pilotId, raisedBy, reason]
    );
    return rows[0];
  },

  async respond({ id, validatorResponse, status }) {
    const { rows } = await pool.query(
      `UPDATE validation_objections
       SET validator_response = $1,
           status             = $2,
           resolved_at        = now()
       WHERE id = $3 RETURNING *`,
      [validatorResponse, status || 'addressed', id]
    );
    return rows[0];
  },

  async findByReport(reportId) {
    const { rows } = await pool.query(
      `SELECT vo.*, u.name AS raised_by_name
       FROM validation_objections vo
       JOIN users u ON vo.raised_by = u.id
       WHERE vo.report_id = $1 ORDER BY vo.created_at`,
      [reportId]
    );
    return rows;
  }
};

module.exports = {
  ValidatorAssignment,
  MilestoneVerification,
  KpiValidation,
  ValidationReport,
  ValidationObjection
};
