/**
 * GovCatalyst — Pilot Controller (DB-backed)
 * All data persisted via pilot.db.js (raw pg pool — no in-memory store)
 */

const {
  Pilot, PilotKpi, PilotRisk, PilotIssue,
  PilotFeedback, PilotEvidence, PilotAuditLog,
  PilotTelemetry, PilotAlert, PilotMilestone
} = require('../models/pilot.db');
const pilotService   = require('../services/pilot.service');
const documentService = require('../services/document.service');
const { formatSuccess, formatError } = require('../utils/responseFormatter');

/** Generate a human-readable pilot code (stored separately from UUID PK) */
function generatePilotCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PILOT-${year}-${rand}`;
}

/** Resolve a pilot by UUID or by pilot_code */
async function resolvePilot(idOrCode) {
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(idOrCode)) {
    return Pilot.findById(idOrCode);
  }
  return Pilot.findByCode(idOrCode);
}

// ─────────────────────────────────────────────────────────────────
// LIST ALL PILOTS
// GET /api/pilots
// ─────────────────────────────────────────────────────────────────
async function getAllPilots(req, res) {
  try {
    const userRole = req.user?.role?.toLowerCase?.();

    // Startups should only see pilots they are assigned to
    if (userRole === 'startup') {
      const Startup = require('../models/startupModel');
      const User = require('../models/userModel');
      
      const user = await User.findById(req.user.user_id);
      const startupProfile = await Startup.findByUserId(req.user.user_id);
      
      const identifiers = [
        startupProfile?.company_name,
        user?.name,
        req.user?.name,
        startupProfile?.id,
        req.user?.user_id
      ].filter(Boolean);
      
      const pilots = await Pilot.findByStartupIdentifiers(identifiers);
      return formatSuccess(res, pilots, 'Pilots retrieved successfully');
    }

    // Admins / validators / evaluators see all pilots
    const pilots = await Pilot.findAll();
    return formatSuccess(res, pilots, 'Pilots retrieved successfully');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET ONE PILOT (with all sub-resources)
// GET /api/pilots/:id
// ─────────────────────────────────────────────────────────────────
async function getPilotById(req, res) {
  try {
    const { id } = req.params;
    const pilot = await resolvePilot(id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    // Eager-load sub-resources in parallel using UUID PK
    const [kpis, risks, issues, feedbackList, evidences] = await Promise.all([
      PilotKpi.findByPilot(pilot.id),
      PilotRisk.findByPilot(pilot.id),
      PilotIssue.findByPilot(pilot.id),
      PilotFeedback.findByPilot(pilot.id),
      PilotEvidence.findByPilot(pilot.id),
    ]);

    const { avgSatisfaction } = await PilotFeedback.averageByPilot(pilot.id);

    return formatSuccess(res, {
      ...pilot,
      kpis,
      risks,
      issues,
      feedbackList,
      evidences,
      averageSatisfaction: avgSatisfaction,
    }, 'Pilot retrieved successfully');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// CREATE PILOT
// POST /api/pilots
// ─────────────────────────────────────────────────────────────────
async function createPilot(req, res) {
  try {
    const data    = req.body;
    const pilotCode = generatePilotCode();
    const user      = req.user?.name || req.user?.email || 'Authorized Officer';
    const userId    = req.user?.user_id || req.user?.id || null;

    // Strict Link Safeguard: Ensure startup has an approved evaluation for this challenge
    const Application = require('../models/applicationModel');
    const challengeId = data.challengeId;
    const startupId = data.startupId;
    
    if (challengeId && startupId) {
      const approvedApps = await Application.findApprovedByChallengeId(challengeId);
      const isApproved = approvedApps.some(app => app.startup_id === startupId);
      if (!isApproved) {
        return formatError(res, 'Startup has not passed the Expert Evaluation Scorecard for this Challenge. Sandbox provisioning rejected.', 403);
      }
    }

    const pilot = await Pilot.create({
      pilotCode,
      name:                  data.name,
      problemStatementText:  data.problemStatement || data.problemStatementText,
      department:            data.department,
      startup:               data.startup,
      startupLead:           data.startupLead,
      solution:              data.solution,
      objective:             data.objective,
      baselineObjective:     data.baselineObjective,
      targetObjective:       data.targetObjective,
      minAcceptableResult:   data.minAcceptableResult,
      successCondition:      data.successCondition,
      location:              data.location,
      startDate:             data.startDate,
      endDate:               data.endDate,
      durationWeeks:         data.durationWeeks,
      usersCount:            data.usersCount,
      scopeIncluded:         data.scopeIncluded,
      scopeExcluded:         data.scopeExcluded,
      budgetAllocated:       data.budgetAllocated,
      pilotOwner:            data.pilotOwner || user,
      cyberChecklist:        data.cyberChecklist,
      dataRules:             data.dataRules,
      ipRules:               data.ipRules,
    });

    // Bulk-insert KPIs if provided
    const pilotId = pilot.id; // UUID primary key from DB
    if (Array.isArray(data.kpis) && data.kpis.length > 0) {
      await Promise.all(data.kpis.map((k, i) =>
        PilotKpi.create({ ...k, pilotId, kpiCode: k.kpiCode || `KPI-${i + 1}` })
      ));
    }

    // Bulk-insert risks if provided
    if (Array.isArray(data.risks) && data.risks.length > 0) {
      await Promise.all(data.risks.map((r, i) =>
        PilotRisk.create({ ...r, pilotId, riskCode: r.riskCode || `RSK-${String(i + 1).padStart(2, '0')}` })
      ));
    }

    await PilotAuditLog.log({
      pilotId:  pilot.id,
      userId,
      action:   'Pilot Created',
      detail:   `Pilot "${pilot.name}" (${pilot.pilot_code}) created for ${pilot.startup}`,
      oldValue: 'None',
      newValue: 'DRAFT',
    });

    return formatSuccess(res, pilot, 'Pilot created successfully', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE STATUS / STATE TRANSITION
// PATCH /api/pilots/:id/status
// ─────────────────────────────────────────────────────────────────
async function updateStatus(req, res) {
  try {
    const { id }                    = req.params;
    const { targetStatus, reason }  = req.body;
    const user   = req.user?.name  || req.user?.email || 'Authorized Officer';
    const userId = req.user?.user_id || req.user?.id  || null;

    const pilot = await resolvePilot(id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    if (!pilotService.canTransition(pilot.status, targetStatus)) {
      return formatError(res,
        `Invalid state transition from "${pilot.status}" to "${targetStatus}"`, 400
      );
    }

    // Security gate: block activation until critical checklist passes
    const activationStates = ['READY_FOR_DEPLOYMENT', 'DEPLOYMENT', 'ACTIVE_PILOT'];
    if (activationStates.includes(targetStatus)) {
      const gate = pilotService.evaluateSecurityGate(pilot.cyber_checklist || []);
      if (!gate.canActivate) {
        return formatError(res,
          'Pilot activation blocked: unresolved critical cybersecurity checks',
          403, gate.failedCriticalChecks
        );
      }
    }

    const updated = await Pilot.updateStatus(pilot.id, targetStatus);

    await PilotAuditLog.log({
      pilotId: pilot.id, userId,
      action: `Status → ${targetStatus}`,
      detail: reason || `Pilot status updated to ${targetStatus}`,
      oldValue: pilot.status,
      newValue: targetStatus,
    });

    return formatSuccess(res, updated, `Status updated to ${targetStatus}`);
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// EVALUATE PILOT OUTCOME (automated engine)
// POST /api/pilots/:id/evaluate
// ─────────────────────────────────────────────────────────────────
async function evaluatePilot(req, res) {
  try {
    const { id }   = req.params;
    const pilot    = await resolvePilot(id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const kpis   = await PilotKpi.findByPilot(pilot.id);
    const risks  = await PilotRisk.findByPilot(pilot.id);

    const evaluation = pilotService.calculateAutomatedOutcome(kpis, risks, pilot.security_status);

    const updated = await Pilot.updateOutcome(
      pilot.id,
      evaluation.outcome,
      req.body.committeeDecision || 'PENDING',
      evaluation.rationale
    );

    await PilotAuditLog.log({
      pilotId: pilot.id,
      userId:  req.user?.user_id || null,
      action:  'Pilot Evaluated',
      detail:  evaluation.rationale,
      oldValue: pilot.outcome,
      newValue: evaluation.outcome,
    });

    return formatSuccess(res, {
      pilotId:   id,
      outcome:   evaluation.outcome,
      rationale: evaluation.rationale,
      pilot:     updated,
    }, 'Pilot evaluated successfully');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// 22-SECTION COMPLETION REPORT
// GET /api/pilots/:id/report
// ─────────────────────────────────────────────────────────────────
async function getCompletionReport(req, res) {
  try {
    const { id } = req.params;
    const pilot  = await resolvePilot(id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const [kpis, risks, issues, feedbackList, evidences] = await Promise.all([
      PilotKpi.findByPilot(pilot.id),
      PilotRisk.findByPilot(pilot.id),
      PilotIssue.findByPilot(pilot.id),
      PilotFeedback.findByPilot(pilot.id),
      PilotEvidence.findByPilot(pilot.id),
    ]);
    const { avgSatisfaction } = await PilotFeedback.averageByPilot(pilot.id);

    // Map DB snake_case columns to the shape document.service expects
    const pilotDoc = {
      id:                   pilot.id,
      name:                 pilot.name,
      problemStatement:     pilot.problem_statement_text,
      problemStatementText: pilot.problem_statement_text,
      department:           pilot.department,
      startup:              pilot.startup,
      startupLead:          pilot.startup_lead,
      solution:             pilot.solution,
      objective:            pilot.objective,
      baselineObjective:    pilot.baseline_objective,
      targetObjective:      pilot.target_objective,
      location:             pilot.location,
      startDate:            pilot.start_date,
      endDate:              pilot.end_date,
      durationWeeks:        pilot.duration_weeks,
      usersCount:           pilot.users_count,
      scopeIncluded:        pilot.scope_included,
      scopeExcluded:        pilot.scope_excluded,
      budgetAllocated:      pilot.budget_allocated,
      budgetSpent:          pilot.budget_spent,
      pilotOwner:           pilot.pilot_owner,
      outcome:              pilot.outcome,
      committeeDecision:    pilot.committee_decision,
      committeeReason:      pilot.committee_reason,
      securityStatus:       pilot.security_status,
      cyberChecklist:       pilot.cyber_checklist,
      dataRules:            pilot.data_rules,
      ipRules:              pilot.ip_rules,
      kpis,
      risks,
      issues,
      feedbackList,
      evidences,
      averageSatisfaction:  avgSatisfaction,
    };

    const report = documentService.generate22SectionReport(pilotDoc);
    return formatSuccess(res, report, '22-Section Completion Report generated');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// KPI ROUTES
// ─────────────────────────────────────────────────────────────────
async function addKpi(req, res) {
  try {
    const { id: pilotId } = req.params;
    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const kpi = await PilotKpi.create({ ...req.body, pilotId: pilot.id });
    return formatSuccess(res, kpi, 'KPI added', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function updateKpi(req, res) {
  try {
    const { kpiId } = req.params;
    const { current } = req.body;

    // Recalculate improvement & status server-side using the service
    const pilotUUID = (await resolvePilot(req.params.id))?.id;
    const existing  = pilotUUID ? await PilotKpi.findByPilot(pilotUUID) : [];
    const kpi = existing.find(k => k.id === kpiId);
    if (!kpi) return formatError(res, 'KPI not found', 404);

    const { improvementPercent, status } = pilotService.calculateKPIImprovement(
      kpi.baseline, current, kpi.target, kpi.min_acceptable, kpi.direction
    );

    const updated = await PilotKpi.update(kpiId, { current, improvementPercent, status });
    return formatSuccess(res, updated, 'KPI updated');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function getKpis(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const kpis = await PilotKpi.findByPilot(pilot.id);
    return formatSuccess(res, kpis, 'KPIs retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// RISK ROUTES
// ─────────────────────────────────────────────────────────────────
async function addRisk(req, res) {
  try {
    const { id: pilotId } = req.params;
    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const risk = await PilotRisk.create({ ...req.body, pilotId: pilot.id });
    return formatSuccess(res, risk, 'Risk added', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function updateRiskStatus(req, res) {
  try {
    const { riskId }  = req.params;
    const { status }  = req.body;
    const updated     = await PilotRisk.updateStatus(riskId, status);
    if (!updated) return formatError(res, 'Risk not found', 404);
    return formatSuccess(res, updated, 'Risk status updated');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function getRisks(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const risks = await PilotRisk.findByPilot(pilot.id);
    return formatSuccess(res, risks, 'Risks retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// ISSUE ROUTES
// ─────────────────────────────────────────────────────────────────
async function addIssue(req, res) {
  try {
    const { id: pilotId } = req.params;
    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const reportedBy = req.body.reportedBy || req.user?.name || 'Officer';
    const issue = await PilotIssue.create({ ...req.body, pilotId: pilot.id, reportedBy });
    return formatSuccess(res, issue, 'Issue logged', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function resolveIssue(req, res) {
  try {
    const { issueId }            = req.params;
    const { resolution, status } = req.body;
    const updated = await PilotIssue.resolve(issueId, { resolution, status });
    if (!updated) return formatError(res, 'Issue not found', 404);
    return formatSuccess(res, updated, 'Issue resolved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function getIssues(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const issues = await PilotIssue.findByPilot(pilot.id);
    return formatSuccess(res, issues, 'Issues retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// FEEDBACK ROUTES
// ─────────────────────────────────────────────────────────────────
async function addFeedback(req, res) {
  try {
    const { id: pilotId } = req.params;
    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const userName = req.body.userName || req.user?.name || 'Anonymous';
    const feedback = await PilotFeedback.create({ ...req.body, pilotId: pilot.id, userName });
    const stats    = await PilotFeedback.averageByPilot(pilot.id);
    return formatSuccess(res, { feedback, stats }, 'Feedback recorded', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function getFeedback(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const [feedbackList, stats] = await Promise.all([
      PilotFeedback.findByPilot(pilot.id),
      PilotFeedback.averageByPilot(pilot.id),
    ]);
    return formatSuccess(res, { feedbackList, stats }, 'Feedback retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// EVIDENCE ROUTES
// ─────────────────────────────────────────────────────────────────
async function addEvidence(req, res) {
  try {
    const { id: pilotId } = req.params;
    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const uploadedBy = req.body.uploadedBy || req.user?.name || 'Officer';
    const evidence   = await PilotEvidence.create({ ...req.body, pilotId: pilot.id, uploadedBy });
    return formatSuccess(res, evidence, 'Evidence submitted', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function verifyEvidence(req, res) {
  try {
    const { evidenceId } = req.params;
    const { status }     = req.body; // 'Verified' | 'Rejected'
    const updated        = await PilotEvidence.verify(evidenceId, status);
    if (!updated) return formatError(res, 'Evidence not found', 404);
    return formatSuccess(res, updated, `Evidence marked as ${status}`);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function getEvidences(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const evidences = await PilotEvidence.findByPilot(pilot.id);
    return formatSuccess(res, evidences, 'Evidences retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// AUDIT LOG
// GET /api/pilots/:id/audit
// ─────────────────────────────────────────────────────────────────
async function getAuditLog(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const logs = await PilotAuditLog.findByPilot(pilot.id);
    return formatSuccess(res, logs, 'Audit log retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// TELEMETRY INGESTION (Manual, CSV, IoT, API, Govt Systems)
// POST /api/pilots/:id/kpis/:kpiId/telemetry
// ─────────────────────────────────────────────────────────────────
async function recordKpiTelemetry(req, res) {
  try {
    const { id: pilotId, kpiId } = req.params;
    const { value, sourceType, sourceReference, provenanceMetadata, recordedAt } = req.body;

    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const kpi = await PilotKpi.findById(kpiId);
    if (!kpi || kpi.pilot_id !== pilot.id) return formatError(res, 'KPI not found for this pilot', 404);

    if (value === undefined || value === null) {
      return formatError(res, 'Telemetry reading value is required', 400);
    }

    // Record telemetry reading
    const reading = await PilotTelemetry.record({
      pilotId: pilot.id,
      kpiId: kpi.id,
      value: parseFloat(value),
      sourceType: sourceType || 'MANUAL',
      sourceReference: sourceReference || `Entered by ${req.user?.name || 'User'}`,
      provenanceMetadata: provenanceMetadata || {},
      recordedAt: recordedAt || new Date().toISOString()
    });

    // Recalculate KPI progress and RAG status
    const kpiImp = pilotService.calculateKPIImprovement(
      kpi.baseline,
      value,
      kpi.target,
      kpi.min_acceptable,
      kpi.direction
    );

    const updatedKpi = await PilotKpi.update(kpi.id, {
      current: parseFloat(value),
      improvementPercent: kpiImp.improvementPercent,
      status: kpiImp.status
    });

    // Check for threshold breach alert
    const alertEval = pilotService.evaluateTelemetryAlert(kpi, value);
    let triggeredAlert = null;
    if (alertEval.hasAlert) {
      triggeredAlert = await PilotAlert.create({
        pilotId: pilot.id,
        kpiId: kpi.id,
        severity: alertEval.severity,
        title: alertEval.title,
        message: alertEval.message,
        expectedValue: alertEval.expectedValue,
        actualValue: alertEval.actualValue,
        variancePct: alertEval.variancePct,
        recipientRole: 'ALL'
      });
    }

    // Log audit trail
    await PilotAuditLog.log({
      pilotId: pilot.id,
      userId: req.user?.id || null,
      action: 'INGEST_KPI_TELEMETRY',
      detail: `Recorded ${value} ${kpi.unit} from ${sourceType || 'MANUAL'} for ${kpi.name}`,
      oldValue: kpi.current,
      newValue: value
    });

    return formatSuccess(res, {
      reading,
      kpi: { ...updatedKpi, rag: kpiImp.rag, progressPercent: kpiImp.progressPercent },
      alert: triggeredAlert
    }, 'Telemetry reading recorded successfully', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// BATCH TELEMETRY INGESTION (CSV upload / IoT Stream)
// POST /api/pilots/:id/telemetry/batch
// ─────────────────────────────────────────────────────────────────
async function recordBatchTelemetry(req, res) {
  try {
    const { id: pilotId } = req.params;
    const { readings, sourceType, batchReference } = req.body;

    const pilot = await resolvePilot(pilotId);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    if (!Array.isArray(readings) || readings.length === 0) {
      return formatError(res, 'Readings array is required', 400);
    }

    const recorded = [];
    const alertsGenerated = [];

    for (const item of readings) {
      const kpi = await PilotKpi.findById(item.kpiId);
      if (kpi && kpi.pilot_id === pilot.id) {
        const val = parseFloat(item.value);
        const r = await PilotTelemetry.record({
          pilotId: pilot.id,
          kpiId: kpi.id,
          value: val,
          sourceType: item.sourceType || sourceType || 'CSV_UPLOAD',
          sourceReference: item.sourceReference || batchReference || 'Batch Stream',
          provenanceMetadata: item.provenanceMetadata || {},
          recordedAt: item.recordedAt || new Date().toISOString()
        });
        recorded.push(r);

        const kpiImp = pilotService.calculateKPIImprovement(kpi.baseline, val, kpi.target, kpi.min_acceptable, kpi.direction);
        await PilotKpi.update(kpi.id, {
          current: val,
          improvementPercent: kpiImp.improvementPercent,
          status: kpiImp.status
        });

        const alertEval = pilotService.evaluateTelemetryAlert(kpi, val);
        if (alertEval.hasAlert) {
          const a = await PilotAlert.create({
            pilotId: pilot.id,
            kpiId: kpi.id,
            severity: alertEval.severity,
            title: alertEval.title,
            message: alertEval.message,
            expectedValue: alertEval.expectedValue,
            actualValue: alertEval.actualValue,
            variancePct: alertEval.variancePct,
            recipientRole: 'ALL'
          });
          alertsGenerated.push(a);
        }
      }
    }

    return formatSuccess(res, {
      totalReadings: recorded.length,
      alertsGeneratedCount: alertsGenerated.length,
      readings: recorded,
      alerts: alertsGenerated
    }, `${recorded.length} telemetry readings batch-ingested successfully`, 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET PILOT TELEMETRY READINGS
// GET /api/pilots/:id/telemetry
// ─────────────────────────────────────────────────────────────────
async function getPilotTelemetry(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const limit = parseInt(req.query.limit) || 100;
    const readings = await PilotTelemetry.findByPilot(pilot.id, limit);
    return formatSuccess(res, readings, 'Telemetry readings retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// ALERTS
// GET /api/pilots/:id/alerts
// PATCH /api/pilots/:id/alerts/:alertId/ack
// ─────────────────────────────────────────────────────────────────
async function getPilotAlerts(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const status = req.query.status || null;
    const alerts = await PilotAlert.findByPilot(pilot.id, status);
    return formatSuccess(res, alerts, 'Alerts retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const { alertId } = req.params;
    const userName = req.user?.name || req.body?.acknowledgedBy || 'Authorized Officer';
    const alert = await PilotAlert.acknowledge(alertId, userName);
    if (!alert) return formatError(res, 'Alert not found', 404);
    return formatSuccess(res, alert, 'Alert acknowledged successfully');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// FINAL PILOT EVALUATION REPORT
// GET /api/pilots/:id/evaluation-report
// ─────────────────────────────────────────────────────────────────
async function getPilotEvaluationReport(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const [kpis, risks, evidences, feedbacks] = await Promise.all([
      PilotKpi.findByPilot(pilot.id),
      PilotRisk.findByPilot(pilot.id),
      PilotEvidence.findByPilot(pilot.id),
      PilotFeedback.findByPilot(pilot.id)
    ]);

    const report = pilotService.generateEvaluationReport(pilot, kpis, risks, evidences, feedbacks);
    return formatSuccess(res, report, 'Pilot Evaluation Report generated successfully');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// FINAL PROCUREMENT RECOMMENDATION (SCALE / MODIFY & RETEST / STOP)
// GET /api/pilots/:id/recommendations
// ─────────────────────────────────────────────────────────────────
async function getPilotRecommendations(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const [kpis, risks] = await Promise.all([
      PilotKpi.findByPilot(pilot.id),
      PilotRisk.findByPilot(pilot.id)
    ]);

    const outcomeAnalysis = pilotService.calculateAutomatedOutcome(kpis, risks, pilot.security_status);
    return formatSuccess(res, {
      pilotId: pilot.id,
      pilotCode: pilot.pilot_code,
      recommendation: outcomeAnalysis.recommendation,
      outcome: outcomeAnalysis.outcome,
      targetAchievementScore: outcomeAnalysis.targetAchievementScore,
      rationale: outcomeAnalysis.rationale,
      procurementAction: outcomeAnalysis.procurementAction
    }, 'Procurement recommendation calculated');
  } catch (err) {
    return formatError(res, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// MILESTONES
// ─────────────────────────────────────────────────────────────────
async function getMilestones(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    const milestones = await PilotMilestone.findByPilot(pilot.id);
    return formatSuccess(res, milestones, 'Milestones retrieved');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function createMilestone(req, res) {
  // Only allow authorized roles to create milestones
  const allowedRoles = ['startup', 'dept_admin', 'super_admin'];
  const userRole = req.user?.role?.toLowerCase?.();
  if (!allowedRoles.includes(userRole)) {
    return formatError(res, 'Access denied. Insufficient permissions to create milestones.', 403);
  }

  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);

    const body = req.body || {};
    // PilotMilestone.create() uses explicit destructuring — pass camelCase milestoneCode directly.
    // The frontend sends milestoneCode; accept it as-is (no rename needed).
    const milestone = await PilotMilestone.create({
      pilotId:       pilot.id,
      milestoneCode: body.milestoneCode || body.milestone_code,
      phase:         body.phase,
      name:          body.name,
      description:   body.description,
      dueDate:       body.dueDate || body.due_date,
      paymentAmount: body.paymentAmount || body.payment_amount,
      paymentLinked: body.paymentLinked !== undefined ? body.paymentLinked : (body.payment_linked !== undefined ? body.payment_linked : true)
    });

    await PilotAuditLog.log({ pilotId: pilot.id, userId: req.user?.user_id || null, action: 'Milestone Created', detail: `Created ${milestone.milestone_code}` });
    return formatSuccess(res, milestone, 'Milestone created', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function updateMilestoneStatus(req, res) {
  try {
    const { milestoneId } = req.params;
    const { status } = req.body;
    const completedDate = status === 'Verified' ? new Date().toISOString() : null;
    
    const milestone = await PilotMilestone.updateStatus(milestoneId, status, completedDate);
    if (!milestone) return formatError(res, 'Milestone not found', 404);
    
    await PilotAuditLog.log({ pilotId: milestone.pilot_id, userId: req.user?.user_id || null, action: 'Milestone Updated', detail: `Status changed to ${status}` });
    return formatSuccess(res, milestone, 'Milestone status updated');
  } catch (err) {
    return formatError(res, err.message);
  }
}

async function autoGenerateMilestones(req, res) {
  try {
    const pilot = await resolvePilot(req.params.id);
    if (!pilot) return formatError(res, 'Pilot not found', 404);
    
    const existing = await PilotMilestone.findByPilot(pilot.id);
    // Allow re-provisioning only if no milestone has been started yet
    if (existing.length > 0) {
      const hasStarted = existing.some(m => m.status !== 'Pending');
      if (hasStarted) {
        return formatError(res, 'Cannot re-provision: one or more milestones are already in progress or completed.', 400);
      }
      // Safe to wipe and re-seed
      await PilotMilestone.deleteByPilot(pilot.id);
    }

    const phases = [
      { code: 'MS-01', phase: 1, name: 'Setup & Bilateral Agreement', desc: 'Indemnity, legal covenants & baseline scoping', days: 10, pct: 15 },
      { code: 'MS-02', phase: 2, name: 'Deployment & Telemetry Integration', desc: 'Sensor install, VPC testbed isolation & telemetry', days: 30, pct: 25 },
      { code: 'MS-03', phase: 3, name: 'Active Sandbox Testing & Execution', desc: 'Field trials, live operational data & mid-term review', days: 60, pct: 30 },
      { code: 'MS-04', phase: 4, name: 'Final Evaluation, Audit & Transition', desc: 'Committee report, validator sign-off & GeM scale', days: 90, pct: 30 }
    ];

    const budget = parseFloat(pilot.budget_allocated) || 0;
    const startDate = new Date(pilot.start_date || Date.now());
    
    for (const p of phases) {
      const dueDate = new Date(startDate.getTime() + p.days * 24 * 60 * 60 * 1000);
      await PilotMilestone.create({
        pilotId: pilot.id,
        milestoneCode: p.code,
        phase: p.phase,
        name: p.name,
        description: p.desc,
        dueDate: dueDate.toISOString().split('T')[0],
        paymentAmount: (budget * p.pct) / 100,
        paymentLinked: true
      });
    }

    await PilotAuditLog.log({ pilotId: pilot.id, userId: req.user?.user_id || null, action: 'Milestones Auto-Generated', detail: 'Standard 4-phase tranches set' });
    const milestones = await PilotMilestone.findByPilot(pilot.id);
    return formatSuccess(res, milestones, '4-Phase Milestones provisioned successfully', 201);
  } catch (err) {
    return formatError(res, err.message);
  }
}

module.exports = {
  getAllPilots, getPilotById, createPilot,
  updateStatus, evaluatePilot, getCompletionReport,
  // KPI
  addKpi, updateKpi, getKpis,
  // Risk
  addRisk, updateRiskStatus, getRisks,
  // Issue
  addIssue, resolveIssue, getIssues,
  // Feedback
  addFeedback, getFeedback,
  // Evidence
  addEvidence, verifyEvidence, getEvidences,
  // Audit
  getAuditLog,
  // Telemetry & Alerts
  recordKpiTelemetry, recordBatchTelemetry, getPilotTelemetry,
  getPilotAlerts, acknowledgeAlert,
  // Evaluation & Recommendations
  getPilotEvaluationReport, getPilotRecommendations,
  // Milestones
  getMilestones, createMilestone, updateMilestoneStatus, autoGenerateMilestones
};

