/**
 * GovCatalyst — Expert Evaluation Controller
 * Implements the human review layer between AI shortlisting and pilot selection.
 *
 * Workflow:
 *   AI shortlists application (score ≥ 75)
 *     → dept_admin seeds evaluation criteria for the challenge
 *     → dept_admin assigns evaluator(s) to the application
 *     → Each evaluator scores all criteria and submits
 *     → dept_admin triggers panel aggregation
 *     → System computes weighted avg → panel recommendation (APPROVE / CONDITIONAL / REJECT)
 *     → dept_admin may override with written justification
 *     → Application status updated → startup notified
 *     → Startup may appeal a rejection (once)
 */

const {
  EvaluationCriteria,
  EvaluationAssignment,
  EvaluationScore,
  PanelDecision,
  EvaluationAppeal,
} = require('../models/evaluation.db');

const pool        = require('../config/db');
const Application = require('../models/applicationModel');
const Challenge   = require('../models/challengeModel');
const Startup     = require('../models/startupModel');
const User        = require('../models/userModel');

// ─────────────────────────────────────────────────────────────────
// CRITERIA MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/evaluations/criteria
 * dept_admin: create a scoring criterion for their challenge
 */
exports.createCriterion = async (req, res) => {
  try {
    const { challengeId, criterionName, description, weight, maxScore, category, sortOrder } = req.body;
    if (!challengeId || !criterionName || !weight) {
      return res.status(400).json({ success: false, message: 'challengeId, criterionName, and weight are required.' });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found.' });

    // dept_admin can only add criteria to their own challenge
    if (req.user.role === 'dept_admin' && challenge.dept_admin_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You do not own this challenge.' });
    }

    const criterion = await EvaluationCriteria.create({
      challengeId, criterionName, description, weight, maxScore, category, sortOrder
    });
    return res.status(201).json({ success: true, criterion });
  } catch (err) {
    console.error('createCriterion error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/criteria/seed/:challengeId
 * dept_admin: seed the standard 5-criterion rubric for a challenge in one shot
 */
exports.seedDefaultCriteria = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found.' });

    if (req.user.role === 'dept_admin' && challenge.dept_admin_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You do not own this challenge.' });
    }

    const criteria = await EvaluationCriteria.seedDefaults(challengeId);
    return res.status(201).json({
      success: true,
      message: `${criteria.length} default criteria seeded for challenge "${challenge.title}".`,
      criteria,
    });
  } catch (err) {
    console.error('seedDefaultCriteria error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/criteria/:challengeId
 * All authenticated roles: view the rubric for a challenge
 */
exports.getCriteria = async (req, res) => {
  try {
    const criteria = await EvaluationCriteria.findByChallenge(req.params.challengeId);
    const totalWeight = criteria.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
    return res.json({ success: true, criteria, totalWeight });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/evaluations/criteria/:criterionId
 * dept_admin / super_admin: update a criterion
 */
exports.updateCriterion = async (req, res) => {
  try {
    const updated = await EvaluationCriteria.update(req.params.criterionId, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Criterion not found.' });
    return res.json({ success: true, criterion: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/evaluations/criteria/:criterionId  (soft-delete)
 */
exports.deleteCriterion = async (req, res) => {
  try {
    await EvaluationCriteria.delete(req.params.criterionId);
    return res.json({ success: true, message: 'Criterion deactivated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// ASSIGNMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/evaluations/assign
 * dept_admin: assign an evaluator to a shortlisted application
 * Body: { applicationId, evaluatorId, dueDate? }
 */
exports.assignEvaluator = async (req, res) => {
  try {
    const { applicationId, evaluatorId, dueDate } = req.body;
    if (!applicationId || !evaluatorId) {
      return res.status(400).json({ success: false, message: 'applicationId and evaluatorId are required.' });
    }

    // Verify application exists and is shortlisted
    const application = await Application.findByChallengeAndStartup(null, null);
    // Direct ID lookup
    const pool = require('../config/db');
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [applicationId]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (!['shortlisted', 'under_evaluation', 'eligibility_passed'].includes(app.status)) {
      return res.status(400).json({
        success: false,
        message: `Application must be shortlisted before assigning evaluators. Current status: ${app.status}`
      });
    }

    // Verify evaluator exists and has correct role
    const evaluator = await User.findById(evaluatorId);
    if (!evaluator) return res.status(404).json({ success: false, message: 'Evaluator user not found.' });
    if (evaluator.role !== 'evaluator') {
      return res.status(400).json({ success: false, message: `User "${evaluator.name}" does not have the evaluator role.` });
    }

    const assignment = await EvaluationAssignment.create({
      applicationId,
      evaluatorId,
      assignedBy: req.user.user_id,
      dueDate,
    });

    // Update application status to under_evaluation
    await pool.query(
      `UPDATE applications SET status = 'under_evaluation', updated_at = now() WHERE id = $1`,
      [applicationId]
    );

    return res.status(201).json({
      success: true,
      message: `Evaluator "${evaluator.name}" assigned to application.`,
      assignment,
    });
  } catch (err) {
    console.error('assignEvaluator error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/assignments/application/:applicationId
 * dept_admin / super_admin: see all evaluator assignments for an application
 */
exports.getAssignmentsByApplication = async (req, res) => {
  try {
    const assignments = await EvaluationAssignment.findByApplication(req.params.applicationId);
    const counts = await EvaluationAssignment.countSubmitted(req.params.applicationId);
    return res.json({ success: true, assignments, counts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/assignments/my
 * evaluator: get their own pending/active assignments
 */
exports.getMyAssignments = async (req, res) => {
  try {
    const assignments = await EvaluationAssignment.findByEvaluator(req.user.user_id);
    return res.json({ success: true, count: assignments.length, assignments });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/assignments/:assignmentId/conflict
 * evaluator: declare a conflict of interest — withdraws from the assignment
 */
exports.declareConflict = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Conflict of interest reason is required.' });

    const assignment = await EvaluationAssignment.findById(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (assignment.evaluator_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only declare conflict on your own assignments.' });
    }

    const updated = await EvaluationAssignment.declareConflict(req.params.assignmentId, reason);
    return res.json({ success: true, message: 'Conflict of interest declared. Assignment withdrawn.', assignment: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/evaluations/scores/submit
 * evaluator: submit all scores for their assignment in one shot
 * Body: { assignmentId, scores: [{ criterionId, score, comments, justification }] }
 */
exports.submitScores = async (req, res) => {
  try {
    let { assignmentId, scores, challengeId, startupId, evaluatorId } = req.body;
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ success: false, message: 'a non-empty scores array is required.' });
    }

    // Auto-resolve assignment if a mock UI one was passed
    if (assignmentId && assignmentId.startsWith('assign_')) {
      if (!challengeId || !startupId || !evaluatorId) {
        return res.status(400).json({ success: false, message: 'challengeId, startupId, and evaluatorId are required when using mock assignment ID.' });
      }
      
      // 1. Ensure application exists
      const { rows: apps } = await pool.query(
        'SELECT id FROM applications WHERE challenge_id = $1 AND startup_id = $2', 
        [challengeId, startupId]
      );
      let applicationId;
      if (apps.length > 0) {
        applicationId = apps[0].id;
      } else {
        // Create baseline application
        const newApp = await Application.create({
          challenge_id: challengeId,
          startup_id: startupId,
          proposal_summary: 'Auto-generated application for evaluation.',
          status: 'shortlisted',
          match_score: 85
        });
        applicationId = newApp.id;
      }

      // 2. Ensure assignment exists
      const { rows: assigns } = await pool.query(
        'SELECT id FROM evaluation_assignments WHERE application_id = $1 AND evaluator_id = $2',
        [applicationId, evaluatorId]
      );
      if (assigns.length > 0) {
        assignmentId = assigns[0].id;
      } else {
        const assignment = await EvaluationAssignment.create({
          applicationId,
          evaluatorId,
          assignedBy: req.user.user_id,
        });
        assignmentId = assignment.id;
        
        await pool.query(
          `UPDATE applications SET status = 'under_evaluation', updated_at = now() WHERE id = $1`,
          [applicationId]
        );
      }
      
      // 3. Map criteria UUIDs
      let criteria = await EvaluationCriteria.findByChallenge(challengeId);
      if (criteria.length === 0) {
        // Auto-seed if empty
        const defaultNames = ['innovation', 'feasibility', 'scalability', 'cost'];
        for (const [idx, cname] of defaultNames.entries()) {
           await EvaluationCriteria.create({
             challengeId,
             criterionName: cname.charAt(0).toUpperCase() + cname.slice(1),
             description: 'Default ' + cname,
             weight: [30, 25, 25, 20][idx],
             maxScore: 10,
             category: 'Technical'
           });
        }
        criteria = await EvaluationCriteria.findByChallenge(challengeId);
      }
      
      // Map string IDs to UUIDs
      for (let s of scores) {
         if (typeof s.criterionId === 'string' && s.criterionId.length < 30) {
             const matched = criteria.find(ac => ac.criterion_name.toLowerCase() === s.criterionId.toLowerCase());
             if (matched) {
                 s.criterionId = matched.id;
             }
         }
      }
    }

    if (!assignmentId) {
      return res.status(400).json({ success: false, message: 'assignmentId is required.' });
    }

    // Verify the assignment belongs to this evaluator
    const assignment = await EvaluationAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (assignment.evaluator_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only submit scores for your own assignments.' });
    }
    if (assignment.status === 'withdrawn') {
      return res.status(400).json({ success: false, message: 'Cannot submit scores — assignment withdrawn due to conflict of interest.' });
    }

    // Validate score range per criterion
    for (const s of scores) {
      if (!s.criterionId) return res.status(400).json({ success: false, message: 'Each score entry must include criterionId.' });
      const criterion = await EvaluationCriteria.findById(s.criterionId);
      if (!criterion) return res.status(404).json({ success: false, message: `Criterion ${s.criterionId} not found.` });
      if (s.score < 0 || s.score > criterion.max_score) {
        return res.status(400).json({
          success: false,
          message: `Score for "${criterion.criterion_name}" must be between 0 and ${criterion.max_score}.`
        });
      }
    }

    // Bulk insert scores
    const savedScores = await EvaluationScore.submitAll(
      assignment.application_id,
      req.user.user_id,
      assignmentId,
      scores
    );

    // Calculate this evaluator's weighted score
    const { weightedScore, criteriaScored } = await EvaluationScore.calcWeightedScore(
      req.user.user_id,
      assignment.application_id
    );

    // Mark assignment as submitted
    await EvaluationAssignment.markSubmitted(assignmentId);

    return res.json({
      success: true,
      message: `${savedScores.length} criteria scored. Your weighted score: ${weightedScore}/100.`,
      criteriaScored,
      weightedScore,
      scores: savedScores,
    });
  } catch (err) {
    console.error('submitScores error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/scores/:applicationId
 * dept_admin / super_admin: view all scores for an application
 */
exports.getScores = async (req, res) => {
  try {
    const scores = await EvaluationScore.findByApplication(req.params.applicationId);

    // Group by evaluator for readability
    const byEvaluator = scores.reduce((acc, s) => {
      const key = s.evaluator_id;
      if (!acc[key]) acc[key] = { evaluatorName: s.evaluator_name, evaluatorEmail: s.evaluator_email, scores: [] };
      acc[key].scores.push(s);
      return acc;
    }, {});

    return res.json({ success: true, applicationId: req.params.applicationId, byEvaluator });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/scores/my/:applicationId
 * evaluator: view their own scores for an application
 */
exports.getMyScores = async (req, res) => {
  try {
    const scores = await EvaluationScore.findByEvaluatorAndApplication(
      req.user.user_id,
      req.params.applicationId
    );
    const { weightedScore } = await EvaluationScore.calcWeightedScore(
      req.user.user_id,
      req.params.applicationId
    );
    return res.json({ success: true, scores, weightedScore });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PANEL DECISION
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/evaluations/panel/:applicationId/finalize
 * dept_admin: trigger panel score aggregation and generate recommendation
 * Body: { panelSummary? }
 */
exports.finalizePanel = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { panelSummary }  = req.body;

    // Check at least one score is submitted
    const counts = await EvaluationAssignment.countSubmitted(applicationId);
    if (counts.submitted === 0) {
      return res.status(400).json({
        success: false,
        message: 'No submitted evaluations found. At least one evaluator must submit scores before finalizing the panel.'
      });
    }

    const decision = await PanelDecision.computeAndSave({
      applicationId,
      finalizedBy: req.user.user_id,
      panelSummary,
    });

    // Update application status based on recommendation
    const pool = require('../config/db');
    const newStatus = decision.recommendation === 'APPROVE'
      ? 'shortlisted'
      : decision.recommendation === 'CONDITIONAL'
        ? 'shortlisted'
        : 'rejected';

    await pool.query(
      `UPDATE applications SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, applicationId]
    );

    return res.json({
      success: true,
      message: `Panel decision finalized. Recommendation: ${decision.recommendation} (Avg score: ${decision.avgScore}/100)`,
      decision,
      evaluatorsSubmitted: counts.submitted,
      evaluatorsTotal:     counts.total,
      applicationStatusUpdatedTo: newStatus,
    });
  } catch (err) {
    console.error('finalizePanel error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/panel/:applicationId
 * dept_admin / super_admin / evaluator: view panel decision
 */
exports.getPanelDecision = async (req, res) => {
  try {
    const decision = await PanelDecision.findByApplication(req.params.applicationId);
    if (!decision) return res.status(404).json({ success: false, message: 'No panel decision found yet. Finalize the panel first.' });
    return res.json({ success: true, decision });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/panel/:applicationId/override
 * dept_admin / super_admin: override the panel recommendation with written justification
 * Body: { overrideDecision: 'APPROVE'|'REJECT'|'CONDITIONAL', overrideReason }
 */
exports.overrideDecision = async (req, res) => {
  try {
    const { applicationId }   = req.params;
    const { overrideDecision, overrideReason } = req.body;

    if (!overrideDecision || !overrideReason) {
      return res.status(400).json({ success: false, message: 'overrideDecision and overrideReason are both required.' });
    }
    if (!['APPROVE', 'REJECT', 'CONDITIONAL'].includes(overrideDecision)) {
      return res.status(400).json({ success: false, message: 'overrideDecision must be APPROVE, REJECT, or CONDITIONAL.' });
    }

    const existing = await PanelDecision.findByApplication(applicationId);
    if (!existing) {
      return res.status(400).json({ success: false, message: 'Finalize the panel first before overriding.' });
    }

    const updated = await PanelDecision.override({
      applicationId,
      overrideDecision,
      overrideReason,
      overrideBy: req.user.user_id,
    });

    // Sync application status with override
    const pool = require('../config/db');
    const newStatus = overrideDecision === 'APPROVE' || overrideDecision === 'CONDITIONAL'
      ? 'shortlisted'
      : 'rejected';
    await pool.query(
      `UPDATE applications SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, applicationId]
    );

    return res.json({
      success: true,
      message: `Panel recommendation overridden to ${overrideDecision}.`,
      decision: updated,
      applicationStatusUpdatedTo: newStatus,
    });
  } catch (err) {
    console.error('overrideDecision error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// FULL EVALUATION SUMMARY (for dashboard)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/evaluations/summary/:applicationId
 * dept_admin / super_admin: full picture — assignments + scores + panel decision
 */
exports.getEvaluationSummary = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const pool = require('../config/db');
    const { rows: appRows } = await pool.query(
      `SELECT a.*, c.title AS challenge_title, s.company_name AS startup_name
       FROM applications a
       JOIN challenges c ON a.challenge_id = c.id
       JOIN startups   s ON a.startup_id   = s.id
       WHERE a.id = $1`,
      [applicationId]
    );
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Application not found.' });

    const [assignments, counts, scores, decision] = await Promise.all([
      EvaluationAssignment.findByApplication(applicationId),
      EvaluationAssignment.countSubmitted(applicationId),
      EvaluationScore.findByApplication(applicationId),
      PanelDecision.findByApplication(applicationId),
    ]);

    return res.json({
      success: true,
      application: appRows[0],
      evaluationProgress: {
        assigned:   counts.total,
        submitted:  counts.submitted,
        pending:    counts.total - counts.submitted,
        isComplete: counts.total > 0 && counts.submitted === counts.total,
      },
      assignments,
      scores,
      panelDecision: decision,
      effectiveRecommendation: decision?.is_overridden
        ? decision.override_decision
        : decision?.panel_recommendation || 'PENDING',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// APPEALS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/evaluations/appeal/:applicationId
 * startup: file an appeal on a rejected application
 * Body: { appealReason, supportingDocs? }
 */
exports.submitAppeal = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { appealReason, supportingDocs } = req.body;

    if (!appealReason) return res.status(400).json({ success: false, message: 'Appeal reason is required.' });

    const startup = await Startup.findByUserId(req.user.user_id);
    if (!startup) return res.status(400).json({ success: false, message: 'Startup profile not found.' });

    const pool = require('../config/db');
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [applicationId]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (app.startup_id !== startup.id) {
      return res.status(403).json({ success: false, message: 'You can only appeal your own applications.' });
    }
    if (app.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Appeals can only be filed for rejected applications.' });
    }

    const appeal = await EvaluationAppeal.create({
      applicationId,
      startupId: startup.id,
      appealReason,
      supportingDocs,
    });

    return res.status(201).json({
      success: true,
      message: 'Appeal submitted. The panel will review your case.',
      appeal,
    });
  } catch (err) {
    console.error('submitAppeal error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/appeals/pending
 * dept_admin / super_admin: list all pending appeals
 */
exports.getPendingAppeals = async (req, res) => {
  try {
    const appeals = await EvaluationAppeal.findAllPending();
    return res.json({ success: true, count: appeals.length, appeals });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/evaluations/appeal/:applicationId/review
 * dept_admin / super_admin: accept or reject an appeal
 * Body: { status: 'accepted'|'rejected', reviewNotes }
 */
exports.reviewAppeal = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be "accepted" or "rejected".' });
    }

    const updated = await EvaluationAppeal.review({
      applicationId: req.params.applicationId,
      status,
      reviewedBy: req.user.user_id,
      reviewNotes,
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Appeal not found.' });

    // If accepted, reopen evaluation
    if (status === 'accepted') {
      const pool = require('../config/db');
      await pool.query(
        `UPDATE applications SET status = 'under_evaluation', updated_at = now() WHERE id = $1`,
        [req.params.applicationId]
      );
    }

    return res.json({
      success: true,
      message: `Appeal ${status}.${status === 'accepted' ? ' Application reopened for re-evaluation.' : ''}`,
      appeal: updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
