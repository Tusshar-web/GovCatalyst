/**
 * GovCatalyst — Pilot Routes (DB-backed)
 * SIH26136 Government Innovation Procurement
 */

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/pilot.controller');
const { authenticate }  = require('../middleware/authMiddleware');
const { requireRole }   = require('../middleware/roleMiddleware');

// All pilot routes require authentication
router.use(authenticate);

// ── Core Pilot ────────────────────────────────────────────────────
router.get('/',    ctrl.getAllPilots);
router.post('/',   requireRole('dept_admin', 'super_admin'), ctrl.createPilot);
router.get('/:id', ctrl.getPilotById);

// Status transition (dept_admin or super_admin)
router.patch('/:id/status', requireRole('dept_admin', 'super_admin'), ctrl.updateStatus);

// Automated outcome evaluation
router.post('/:id/evaluate', requireRole('dept_admin', 'super_admin', 'evaluator'), ctrl.evaluatePilot);

// 22-section completion report
router.get('/:id/report', ctrl.getCompletionReport);

// Audit log
router.get('/:id/audit', ctrl.getAuditLog);

// ── KPIs ─────────────────────────────────────────────────────────
router.get( '/:id/kpis',            ctrl.getKpis);
router.post('/:id/kpis',            requireRole('dept_admin', 'super_admin'), ctrl.addKpi);
router.patch('/:id/kpis/:kpiId',    requireRole('dept_admin', 'super_admin', 'evaluator'), ctrl.updateKpi);

// ── Risks ─────────────────────────────────────────────────────────
router.get( '/:id/risks',              ctrl.getRisks);
router.post('/:id/risks',              requireRole('dept_admin', 'super_admin'), ctrl.addRisk);
router.patch('/:id/risks/:riskId/status', requireRole('dept_admin', 'super_admin'), ctrl.updateRiskStatus);

// ── Issues ───────────────────────────────────────────────────────
router.get( '/:id/issues',                   ctrl.getIssues);
router.post('/:id/issues',                   ctrl.addIssue);   // any auth'd user can log an issue
router.patch('/:id/issues/:issueId/resolve', requireRole('dept_admin', 'super_admin'), ctrl.resolveIssue);

// ── Feedback ─────────────────────────────────────────────────────
router.get( '/:id/feedback', ctrl.getFeedback);
router.post('/:id/feedback', ctrl.addFeedback); // any auth'd user can submit feedback

// ── Evidence ─────────────────────────────────────────────────────
router.get( '/:id/evidences',                         ctrl.getEvidences);
router.post('/:id/evidences',                         ctrl.addEvidence);
router.patch('/:id/evidences/:evidenceId/verify',     requireRole('validator', 'super_admin', 'evaluator'), ctrl.verifyEvidence);

// ── Telemetry Ingestion (Manual, CSV, IoT, API, Govt Systems) ───
router.get( '/:id/telemetry',                        ctrl.getPilotTelemetry);
router.post('/:id/kpis/:kpiId/telemetry',            ctrl.recordKpiTelemetry);
router.post('/:id/telemetry/batch',                  ctrl.recordBatchTelemetry);

// ── Performance Threshold Alerts ─────────────────────────────────
router.get(  '/:id/alerts',                          ctrl.getPilotAlerts);
router.patch('/:id/alerts/:alertId/ack',             ctrl.acknowledgeAlert);

// ── Final Evaluation Report & Recommendations ────────────────────
router.get('/:id/evaluation-report',                 ctrl.getPilotEvaluationReport);
router.get('/:id/recommendations',                   ctrl.getPilotRecommendations);

// ── Milestones ───────────────────────────────────────────────────
router.get( '/:id/milestones',                       ctrl.getMilestones);
router.post('/:id/milestones',                       requireRole('dept_admin', 'super_admin'), ctrl.createMilestone);
router.post('/:id/milestones/auto',                  requireRole('dept_admin', 'super_admin'), ctrl.autoGenerateMilestones);
router.patch('/:id/milestones/:milestoneId/status',  requireRole('dept_admin', 'super_admin', 'validator', 'startup'), ctrl.updateMilestoneStatus);

module.exports = router;

