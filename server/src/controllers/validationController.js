/**
 * GovCatalyst — Independent Validation Controller
 * Handles the independent 3rd-party validator verification workflow for pilots.
 *
 * Workflow:
 *   dept_admin assigns a validator to a pilot (gov_pilots)
 *     → Validator reviews milestones & evidences (signs off milestone verification)
 *     → Validator audits KPI performance against baseline/targets and source telemetry
 *     → Validator generates composite 4-dimension Validation Report (KPI achievement, data integrity, process compliance, stakeholder feedback)
 *     → Validator certifies readiness for procurement & scale-up with conditions
 *     → dept_admin can raise objections if discrepancies are contested
 *     → Validator responds to resolve objections
 */

const {
  ValidatorAssignment,
  MilestoneVerification,
  KpiValidation,
  ValidationReport,
  ValidationObjection
} = require('../models/validation.db');
const { Pilot } = require('../models/pilot.db');
const User = require('../models/userModel');
const { formatSuccess, formatError } = require('../utils/responseFormatter');

// ─────────────────────────────────────────────────────────────────
// VALIDATOR ASSIGNMENT CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/validations/assign
 * dept_admin / super_admin: Assign an independent validator to a pilot
 */
async function assignValidator(req, res) {
  try {
    const { pilotId, validatorId, scope, dueDate } = req.body;
    if (!pilotId || !validatorId) {
      return formatError(res, 'pilotId and validatorId are required', 400);
    }

    // Verify pilot exists
    const pilot = await Pilot.findById(pilotId);
    if (!pilot) {
      return formatError(res, 'Pilot not found', 404);
    }

    // Verify user is a validator
    const validatorUser = await User.findById(validatorId);
    if (!validatorUser) {
      return formatError(res, 'Validator user not found', 404);
    }
    if (validatorUser.role !== 'validator') {
      return formatError(res, `User "${validatorUser.name}" does not have the validator role.`, 400);
    }

    const assignment = await ValidatorAssignment.create({
      pilotId,
      validatorId,
      assignedBy: req.user.user_id || req.user.id,
      scope,
      dueDate
    });

    return formatSuccess(res, {
      assignment,
      pilotCode: pilot.pilot_code,
      validatorName: validatorUser.name
    }, 'Validator assigned successfully', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/assignments/pilot/:pilotId
 * dept_admin / super_admin: View all validator assignments for a pilot
 */
async function getAssignmentsByPilot(req, res) {
  try {
    const { pilotId } = req.params;
    const assignments = await ValidatorAssignment.findByPilot(pilotId);
    return formatSuccess(res, assignments, 'Validator assignments retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/assignments/my
 * validator: View assigned pilots in the validator's queue
 */
async function getMyAssignments(req, res) {
  try {
    const validatorId = req.user.user_id || req.user.id;
    const assignments = await ValidatorAssignment.findByValidator(validatorId);
    return formatSuccess(res, assignments, 'Assigned validation tasks retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * PATCH /api/validations/assignments/:id/activate
 * validator: Accept/activate validation assignment
 */
async function activateAssignment(req, res) {
  try {
    const { id } = req.params;
    const assignment = await ValidatorAssignment.findById(id);
    if (!assignment) return formatError(res, 'Assignment not found', 404);

    const userId = req.user.user_id || req.user.id;
    if (assignment.validator_id !== userId && req.user.role !== 'super_admin') {
      return formatError(res, 'Access denied to this assignment', 403);
    }

    const updated = await ValidatorAssignment.activate(id);
    return formatSuccess(res, updated, 'Assignment marked as active');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// MILESTONE VERIFICATION CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/validations/milestones
 * validator: Create/record a milestone verification check
 */
async function recordMilestoneVerification(req, res) {
  try {
    const { assignmentId, milestoneRef, claimedKpiActual, evidenceIds } = req.body;
    if (!assignmentId || !milestoneRef) {
      return formatError(res, 'assignmentId and milestoneRef are required', 400);
    }

    const assignment = await ValidatorAssignment.findById(assignmentId);
    if (!assignment) return formatError(res, 'Assignment not found', 404);

    const userId = req.user.user_id || req.user.id;
    if (assignment.validator_id !== userId && req.user.role !== 'super_admin') {
      return formatError(res, 'Only the assigned validator can record milestone checks', 403);
    }

    const item = await MilestoneVerification.create({
      assignmentId,
      pilotId: assignment.pilot_id,
      validatorId: userId,
      milestoneRef,
      claimedKpiActual,
      evidenceIds
    });

    return formatSuccess(res, item, 'Milestone verification recorded', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * PATCH /api/validations/milestones/:id/verify
 * validator: Sign off or reject a milestone verification
 */
async function submitMilestoneVerification(req, res) {
  try {
    const { id } = req.params;
    const { verifiedKpiActual, verificationStatus, notes } = req.body;

    if (!verificationStatus || !['verified', 'partially_verified', 'failed'].includes(verificationStatus)) {
      return formatError(res, 'verificationStatus must be verified, partially_verified, or failed', 400);
    }

    const updated = await MilestoneVerification.verify({
      id,
      verifiedKpiActual,
      verificationStatus,
      notes
    });

    if (!updated) return formatError(res, 'Milestone verification record not found', 404);

    return formatSuccess(res, updated, `Milestone verification marked as ${verificationStatus}`);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/milestones/pilot/:pilotId
 * View milestone verifications for a pilot
 */
async function getMilestoneVerificationsByPilot(req, res) {
  try {
    const { pilotId } = req.params;
    const verifications = await MilestoneVerification.findByPilot(pilotId);
    const summary = await MilestoneVerification.summaryByPilot(pilotId);
    return formatSuccess(res, { verifications, summary }, 'Milestone verifications retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// KPI VALIDATION CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/validations/kpis
 * validator: Initiate/register a KPI audit entry
 */
async function registerKpiValidation(req, res) {
  try {
    const { assignmentId, kpiId, claimedValue, dataSources } = req.body;
    if (!assignmentId || !kpiId || claimedValue === undefined) {
      return formatError(res, 'assignmentId, kpiId, and claimedValue are required', 400);
    }

    const assignment = await ValidatorAssignment.findById(assignmentId);
    if (!assignment) return formatError(res, 'Assignment not found', 404);

    const userId = req.user.user_id || req.user.id;
    if (assignment.validator_id !== userId && req.user.role !== 'super_admin') {
      return formatError(res, 'Only the assigned validator can validate KPIs', 403);
    }

    const kpiVal = await KpiValidation.create({
      assignmentId,
      pilotId: assignment.pilot_id,
      kpiId,
      validatorId: userId,
      claimedValue,
      dataSources
    });

    return formatSuccess(res, kpiVal, 'KPI validation item created', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * PATCH /api/validations/kpis/:id/validate
 * validator: Attest verified value, verdict, and discrepancy
 */
async function submitKpiValidation(req, res) {
  try {
    const { id } = req.params;
    const { verifiedValue, dataSources, verdict, notes } = req.body;

    if (verifiedValue === undefined || !verdict || !['confirmed', 'adjusted', 'disputed'].includes(verdict)) {
      return formatError(res, 'verifiedValue and valid verdict (confirmed, adjusted, disputed) are required', 400);
    }

    const updated = await KpiValidation.validate({
      id,
      verifiedValue,
      dataSources,
      verdict,
      notes
    });

    if (!updated) return formatError(res, 'KPI validation record not found', 404);

    return formatSuccess(res, updated, `KPI validation saved with verdict: ${verdict}`);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/kpis/pilot/:pilotId
 * View all KPI validations for a pilot
 */
async function getKpiValidationsByPilot(req, res) {
  try {
    const { pilotId } = req.params;
    const validations = await KpiValidation.findByPilot(pilotId);
    return formatSuccess(res, validations, 'KPI validations retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION REPORT CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/validations/reports
 * validator: Draft or update composite 4-dimension validation report
 */
async function saveValidationReport(req, res) {
  try {
    const {
      assignmentId,
      kpiAchievementScore,
      dataIntegrityScore,
      processComplianceScore,
      stakeholderFeedbackScore,
      executiveSummary,
      keyFindings,
      deviationsNoted,
      recommendations,
      readyForProcurement,
      readyForScale,
      clearanceConditions
    } = req.body;

    if (!assignmentId) {
      return formatError(res, 'assignmentId is required', 400);
    }

    const assignment = await ValidatorAssignment.findById(assignmentId);
    if (!assignment) return formatError(res, 'Assignment not found', 404);

    const userId = req.user.user_id || req.user.id;
    if (assignment.validator_id !== userId && req.user.role !== 'super_admin') {
      return formatError(res, 'Only the assigned validator can draft this report', 403);
    }

    const report = await ValidationReport.upsert({
      assignmentId,
      pilotId: assignment.pilot_id,
      validatorId: userId,
      kpiAchievementScore: parseFloat(kpiAchievementScore || 0),
      dataIntegrityScore: parseFloat(dataIntegrityScore || 0),
      processComplianceScore: parseFloat(processComplianceScore || 0),
      stakeholderFeedbackScore: parseFloat(stakeholderFeedbackScore || 0),
      executiveSummary,
      keyFindings,
      deviationsNoted,
      recommendations,
      readyForProcurement: Boolean(readyForProcurement),
      readyForScale: Boolean(readyForScale),
      clearanceConditions
    });

    return formatSuccess(res, report, 'Validation report saved as draft');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * POST /api/validations/reports/:assignmentId/submit
 * validator: Lock and submit the final validation report
 */
async function submitValidationReport(req, res) {
  try {
    const { assignmentId } = req.params;

    const assignment = await ValidatorAssignment.findById(assignmentId);
    if (!assignment) return formatError(res, 'Assignment not found', 404);

    const userId = req.user.user_id || req.user.id;
    if (assignment.validator_id !== userId && req.user.role !== 'super_admin') {
      return formatError(res, 'Only the assigned validator can submit this report', 403);
    }

    const submitted = await ValidationReport.submit(assignmentId);
    if (!submitted) return formatError(res, 'Draft report not found or already submitted', 400);

    // Complete the assignment
    await ValidatorAssignment.complete(assignmentId);

    return formatSuccess(res, submitted, 'Validation report officially submitted and locked');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/reports/assignment/:assignmentId
 * View validation report by assignment
 */
async function getValidationReportByAssignment(req, res) {
  try {
    const { assignmentId } = req.params;
    const report = await ValidationReport.findByAssignment(assignmentId);
    if (!report) return formatError(res, 'Validation report not found', 404);
    return formatSuccess(res, report, 'Validation report retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/reports/pilot/:pilotId
 * View validation reports for a pilot
 */
async function getValidationReportsByPilot(req, res) {
  try {
    const { pilotId } = req.params;
    const reports = await ValidationReport.findByPilot(pilotId);
    return formatSuccess(res, reports, 'Pilot validation reports retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// OBJECTION CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/validations/objections
 * dept_admin / super_admin: Raise an objection against a validation report
 */
async function raiseObjection(req, res) {
  try {
    const { reportId, pilotId, reason } = req.body;
    if (!reportId || !pilotId || !reason) {
      return formatError(res, 'reportId, pilotId, and reason are required', 400);
    }

    const objection = await ValidationObjection.create({
      reportId,
      pilotId,
      raisedBy: req.user.user_id || req.user.id,
      reason
    });

    return formatSuccess(res, objection, 'Objection submitted to validator', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * PATCH /api/validations/objections/:id/respond
 * validator: Provide clarification or adjustment in response to an objection
 */
async function respondToObjection(req, res) {
  try {
    const { id } = req.params;
    const { validatorResponse, status } = req.body;

    if (!validatorResponse) {
      return formatError(res, 'validatorResponse is required', 400);
    }

    const updated = await ValidationObjection.respond({
      id,
      validatorResponse,
      status: status || 'addressed'
    });

    if (!updated) return formatError(res, 'Objection not found', 404);

    return formatSuccess(res, updated, 'Response to objection recorded');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * GET /api/validations/objections/report/:reportId
 * View objections for a report
 */
async function getObjectionsByReport(req, res) {
  try {
    const { reportId } = req.params;
    const objections = await ValidationObjection.findByReport(reportId);
    return formatSuccess(res, objections, 'Objections retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// ADMIN SIGNOFF CONTROLLERS
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/validations/admin/signoffs
 * super_admin: Fetch all validator assignments globally for the admin view
 */
async function getAllSignoffs(req, res) {
  try {
    const assignments = await ValidatorAssignment.findAllAssignments();
    return formatSuccess(res, assignments, 'All sign-offs retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

/**
 * POST /api/validations/admin/signoffs/:id/execute
 * super_admin: Force execute/sign-off a validation
 */
async function executeAdminSignoff(req, res) {
  try {
    const { id } = req.params;
    
    // Complete the assignment
    const updated = await ValidatorAssignment.complete(id);
    if (!updated) return formatError(res, 'Assignment not found', 404);

    // Also write an audit log
    const { logAction } = require('./auditController');
    const actorId = req.user ? (req.user.user_id || req.user.id) : updated.validator_id;
    await logAction(
      actorId,
      'Sign-off Approved',
      'Admin',
      id,
      `Independent validator verification certified for ${id} on pilot ${updated.pilot_id}`
    );

    return formatSuccess(res, updated, 'Audit Sign-Off successfully recorded!');
  } catch (err) {
    return formatError(res, err.message);
  }
}

module.exports = {
  // Assignments
  assignValidator,
  getAssignmentsByPilot,
  getMyAssignments,
  activateAssignment,
  // Milestones
  recordMilestoneVerification,
  submitMilestoneVerification,
  getMilestoneVerificationsByPilot,
  // KPIs
  registerKpiValidation,
  submitKpiValidation,
  getKpiValidationsByPilot,
  // Reports
  saveValidationReport,
  submitValidationReport,
  getValidationReportByAssignment,
  getValidationReportsByPilot,
  // Objections
  raiseObjection,
  respondToObjection,
  getObjectionsByReport,
  // Admin
  getAllSignoffs,
  executeAdminSignoff
};
