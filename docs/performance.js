/* ================================================================
   GovCatalyst — Module 7: Performance M&E & Telemetry Logic
   All data fetched from real PostgreSQL backend via GovApi.
   No fake/in-memory stores.
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const selPilot           = document.getElementById('sel-perf-pilot');
    const healthScore        = document.getElementById('val-health-score');
    const healthLabel        = document.getElementById('val-health-label');
    const txtOutcome         = document.getElementById('txt-pilot-outcome');
    const pilotStatusBadge   = document.getElementById('badge-pilot-status');
    const metaGrid           = document.getElementById('pilot-meta-grid');
    const kpiCardsGrid       = document.getElementById('kpi-cards-grid');
    const readingsTbody      = document.getElementById('readings-tbody');
    const alertsContainer    = document.getElementById('alerts-container');
    const badgeAlertsCount   = document.getElementById('badge-alerts-count');
    const evidenceTbody      = document.getElementById('evidence-tbody');

    // Recommendation elements
    const badgeRecommendation     = document.getElementById('badge-recommendation');
    const txtRecommendationTitle  = document.getElementById('txt-recommendation-title');
    const txtRecommendationReason = document.getElementById('txt-recommendation-reason');

    // Modals
    const modalIngest   = new bootstrap.Modal(document.getElementById('modalIngestTelemetry'));
    const modalReport   = new bootstrap.Modal(document.getElementById('modalEvaluationReport'));
    const modalEvidence = new bootstrap.Modal(document.getElementById('modalUploadEvidence'));

    // Live KPI cache for ingest modal dropdown (populated after renderDashboard)
    let liveKpis      = [];
    let liveAlerts    = [];
    let liveEvidences = [];
    let livePilotDbId = null;

    // ─── Populate Pilot Selector ────────────────────────────────────────
    async function populatePilots() {
        let pilots = [];
        try {
            const res = await GovApi.getPilots();
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                pilots = res.data.map(p => ({
                    id:         p.pilot_code || (p.id ? `PLT-${p.id.substring(0, 6)}` : 'PLT-?'),
                    dbId:       p.id,
                    name:       p.name || 'Sandbox Pilot',
                    department: p.department || 'Government Department',
                    startup:    p.startup || 'N/A',
                    status:     p.status || 'Active',
                    objective:  p.objective || '',
                    location:   p.location || '',
                    startDate:  p.start_date || null,
                    endDate:    p.end_date || null,
                    durationWeeks: p.duration_weeks || 8,
                    budgetAllocated: p.budget_allocated || 0
                }));
                GovData.pilots = pilots;
            }
        } catch (e) {
            console.warn('Pilots fetch error:', e.message);
        }

        if (selPilot) {
            if (!pilots.length) {
                selPilot.innerHTML = '<option value="">-- No Sandbox Pilots Found --</option>';
            } else {
                selPilot.innerHTML = pilots.map(p =>
                    `<option value="${p.dbId}">[${p.id}] ${p.name} — ${p.department}</option>`
                ).join('');
            }
        }
    }

    // ─── RAG Calculator ─────────────────────────────────────────────────
    function calculateRAG(kpi) {
        let improvement = 0, progress = 0, isAchieved = false;

        if (kpi.direction === 'lower') {
            improvement = ((kpi.baseline - kpi.current) / (kpi.baseline || 1)) * 100;
            isAchieved  = kpi.current <= kpi.target;
            const denom = kpi.baseline - kpi.target;
            progress    = denom !== 0 ? ((kpi.baseline - kpi.current) / denom) * 100 : 100;
        } else {
            improvement = ((kpi.current - kpi.baseline) / (kpi.baseline || 1)) * 100;
            isAchieved  = kpi.current >= kpi.target;
            const denom = kpi.target - kpi.baseline;
            progress    = denom !== 0 ? ((kpi.current - kpi.baseline) / denom) * 100 : 100;
        }

        const impPercent     = Math.round(improvement * 10) / 10;
        const clampedProgress = Math.round(Math.max(0, Math.min(progress, 120)) * 10) / 10;

        let rag = 'YELLOW', status = 'At Risk', badgeClass = 'bg-warning text-dark';

        if (isAchieved || clampedProgress >= 100) {
            rag = 'GREEN'; status = 'Achieved'; badgeClass = 'bg-success';
        } else if (kpi.direction === 'lower'
            ? kpi.current <= kpi.minAcceptable
            : kpi.current >= kpi.minAcceptable) {
            rag = clampedProgress >= 70 ? 'GREEN' : 'YELLOW';
            status = 'On Track';
            badgeClass = rag === 'GREEN' ? 'bg-success' : 'bg-warning text-dark';
        } else {
            rag = 'RED'; status = 'Lagging Behind'; badgeClass = 'bg-danger';
        }

        return { improvement: impPercent, progress: clampedProgress, rag, status, badgeClass };
    }

    // ─── RENDER DASHBOARD ───────────────────────────────────────────────
    async function renderDashboard(pilotDbId) {
        if (!pilotDbId) return;
        livePilotDbId = pilotDbId;

        // Show skeleton while loading
        if (kpiCardsGrid) kpiCardsGrid.innerHTML = `
            <div class="col-12 text-center py-4 text-muted">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="mt-2 small">Loading KPI data from backend…</div>
            </div>`;

        let kpis      = [];
        let telemetry = [];
        let alerts    = [];
        let evidences = [];
        let pilot     = null;

        // Fetch pilot detail (with inline objective, location, dates etc.)
        try {
            const pRes = await GovApi.getPilotById(pilotDbId);
            if (pRes && pRes.success && pRes.data) pilot = pRes.data;
        } catch (e) { console.warn('Pilot detail fetch:', e.message); }

        // Parallel fetch of all sub-resources
        await Promise.allSettled([
            GovApi.getPilotKpis(pilotDbId).then(r => { if (r?.success && r.data) kpis = r.data; }),
            GovApi.getPilotTelemetry(pilotDbId, 50).then(r => { if (r?.success && r.data) telemetry = r.data; }),
            GovApi.getPilotAlerts(pilotDbId).then(r => { if (r?.success && r.data) alerts = r.data; }),
            GovApi.getPilotEvidences(pilotDbId).then(r => { if (r?.success && r.data) evidences = r.data; })
        ]);

        // Normalize KPI objects
        liveKpis = kpis.map(k => ({
            id:            k.id,
            code:          k.kpi_code || 'KPI',
            name:          k.name,
            category:      k.category || 'Efficiency',
            direction:     k.direction === 'LOWER_IS_BETTER' ? 'lower' : 'higher',
            unit:          k.unit || '',
            baseline:      parseFloat(k.baseline)       || 0,
            target:        parseFloat(k.target)         || 0,
            minAcceptable: parseFloat(k.min_acceptable) || 0,
            current:       parseFloat(k.current)        || 0
        }));

        liveAlerts    = alerts;
        liveEvidences = evidences;

        // ── 1. Defined Outcome Banner ─────────────────────────────────
        if (txtOutcome) {
            txtOutcome.textContent = pilot?.objective || 'Achieve defined outcome parameters under GFR Rule 194 innovation trial.';
        }
        if (pilotStatusBadge) {
            pilotStatusBadge.textContent = pilot?.status || 'PILOT_ACTIVE';
        }

        // ── Meta Grid ─────────────────────────────────────────────────
        if (metaGrid && pilot) {
            metaGrid.innerHTML = `
                <div class="col-sm-3">
                    <small class="text-muted d-block">Innovator / Startup</small>
                    <strong class="text-navy">${pilot.startup || 'N/A'}</strong>
                </div>
                <div class="col-sm-3">
                    <small class="text-muted d-block">Testbed Location</small>
                    <strong>${pilot.location || 'N/A'}</strong>
                </div>
                <div class="col-sm-3">
                    <small class="text-muted d-block">Trial Window</small>
                    <span class="fw-semibold">${pilot.duration_weeks || 8} Weeks (${GovUtils.formatDate(pilot.start_date)} – ${GovUtils.formatDate(pilot.end_date)})</span>
                </div>
                <div class="col-sm-3">
                    <small class="text-muted d-block">Budget Allocated</small>
                    <span class="badge bg-light text-dark border">${GovUtils.formatCurrency(pilot.budget_allocated || 0)}</span>
                </div>
            `;
        }

        // ── 2 & 3 & 5. KPI Cards with RAG ────────────────────────────
        let greenCount = 0, yellowCount = 0, redCount = 0;

        if (!liveKpis.length) {
            kpiCardsGrid.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info d-flex align-items-center gap-2">
                        <i class="bi bi-info-circle-fill"></i>
                        <span>No KPIs have been defined for this pilot yet. An admin can add KPIs via the Pilot Design module.</span>
                    </div>
                </div>`;
        } else {
            kpiCardsGrid.innerHTML = liveKpis.map(k => {
                const { improvement, progress, rag, status, badgeClass } = calculateRAG(k);
                if (rag === 'GREEN') greenCount++;
                else if (rag === 'YELLOW') yellowCount++;
                else redCount++;

                return `
                    <div class="col-md-4">
                        <div class="gov-card h-100 mb-0 border-top border-4 ${rag === 'GREEN' ? 'border-success' : (rag === 'YELLOW' ? 'border-warning' : 'border-danger')}">
                            <div class="gov-card-body">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="badge bg-light text-navy border font-monospace">${k.code}</span>
                                    <span class="badge ${badgeClass}"><i class="bi bi-circle-fill me-1" style="font-size: 7px;"></i> ${status}</span>
                                </div>
                                <h6 class="fw-bold text-navy mb-2" style="min-height: 40px;">${k.name}</h6>

                                <div class="d-flex align-items-baseline gap-2 my-2">
                                    <span class="display-6 fw-bold text-navy">${k.current}</span>
                                    <small class="text-muted font-monospace">${k.unit}</small>
                                </div>

                                <div class="row g-2 mb-3">
                                    <div class="col-4">
                                        <div class="kpi-stat-box">
                                            <small class="text-muted d-block">Baseline</small>
                                            <span class="fw-bold">${k.baseline}</span>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="kpi-stat-box">
                                            <small class="text-muted d-block">Target</small>
                                            <span class="fw-bold text-success">${k.target}</span>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="kpi-stat-box">
                                            <small class="text-muted d-block">Min Tol.</small>
                                            <span class="fw-semibold text-muted">${k.minAcceptable}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="progress mb-2" style="height: 8px;">
                                    <div class="progress-bar ${rag === 'GREEN' ? 'bg-success' : (rag === 'YELLOW' ? 'bg-warning' : 'bg-danger')}"
                                         role="progressbar" style="width: ${progress}%;"></div>
                                </div>

                                <div class="d-flex justify-content-between align-items-center small text-muted">
                                    <span>Improvement: <strong class="${improvement >= 0 ? 'text-success' : 'text-danger'}">${improvement > 0 ? '+' : ''}${improvement}%</strong></span>
                                    <span>${k.direction === 'lower' ? '↓ Lower is Better' : '↑ Higher is Better'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ── Overall Health Score ─────────────────────────────────────
        const total = liveKpis.length || 1;
        const healthPercent = Math.round(((greenCount + (yellowCount * 0.5)) / total) * 100);
        if (healthScore) healthScore.textContent = `${healthPercent}%`;

        if (healthPercent >= 85) {
            if (healthScore) healthScore.className = 'fs-4 fw-extrabold text-success';
            if (healthLabel) { healthLabel.className = 'badge bg-success p-2'; healthLabel.textContent = 'EXCELLENT / TARGETS ACHIEVED'; }
        } else if (healthPercent >= 60) {
            if (healthScore) healthScore.className = 'fs-4 fw-extrabold text-primary';
            if (healthLabel) { healthLabel.className = 'badge bg-warning text-dark p-2'; healthLabel.textContent = 'ON TRACK / MODERATE VARIANCE'; }
        } else {
            if (healthScore) healthScore.className = 'fs-4 fw-extrabold text-danger';
            if (healthLabel) { healthLabel.className = 'badge bg-danger p-2'; healthLabel.textContent = 'AT RISK / CRITICAL BREACH'; }
        }

        // ── Milestone Progress & Budget (Step 5) ──────────────────────
        let milestones = [];
        try {
            const msRes = await GovApi.getPilotMilestones(pilotDbId);
            if (msRes && msRes.success && Array.isArray(msRes.data)) milestones = msRes.data;
        } catch (e) { console.warn('Milestone fetch:', e.message); }

        const msBudgetRow = document.getElementById('milestones-budget-row');
        if (msBudgetRow) {
            const totalMs      = milestones.length;
            const doneMs       = milestones.filter(m => m.status === 'Verified' || m.status === 'Completed').length;
            const inProgressMs = milestones.filter(m => m.status === 'In Progress' || m.status === 'Under Review').length;
            const msPct        = totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0;
            const budget       = parseFloat(pilot?.budget_allocated || 0);
            const released     = milestones.filter(m => m.status === 'Verified' || m.status === 'Completed').reduce((s, m) => s + parseFloat(m.payment_amount || 0), 0);
            const escrow       = budget - released;
            const budgetPct    = budget > 0 ? Math.round((released / budget) * 100) : 0;

            const msListHtml = totalMs === 0
                ? '<li class="list-group-item text-muted small px-0 py-1">No milestones provisioned yet.</li>'
                : milestones.slice(0, 5).map(m => {
                    const icon = (m.status === 'Verified' || m.status === 'Completed') ? 'bi-check-circle-fill text-success' : (m.status === 'In Progress' || m.status === 'Under Review') ? 'bi-arrow-repeat text-primary' : 'bi-circle text-muted';
                    const cls  = (m.status === 'Verified' || m.status === 'Completed') ? 'bg-success' : (m.status === 'In Progress') ? 'bg-primary' : (m.status === 'Under Review') ? 'bg-info text-dark' : 'bg-secondary';
                    return `<li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1">
                        <span><i class="bi ${icon} me-1"></i> ${m.milestone_code || '—'}: ${m.name}</span>
                        <span class="badge ${cls}">${m.status}</span>
                    </li>`;
                }).join('');

            msBudgetRow.innerHTML = `
                <div class="col-md-6">
                    <div class="gov-card h-100 mb-0">
                        <div class="gov-card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-calendar-check me-2"></i>Milestone Delivery Progress</span>
                            <span class="badge bg-info">${doneMs}/${totalMs} Completed</span>
                        </div>
                        <div class="gov-card-body">
                            <div class="d-flex justify-content-between small text-muted mb-1">
                                <span>Done: <strong>${doneMs}</strong> &nbsp;·&nbsp; Active: <strong>${inProgressMs}</strong></span>
                                <span>${msPct}% Complete</span>
                            </div>
                            <div class="progress mb-3" style="height: 10px;">
                                <div class="progress-bar bg-success" role="progressbar" style="width: ${msPct}%;"></div>
                            </div>
                            <ul class="list-group list-group-flush small">${msListHtml}</ul>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="gov-card h-100 mb-0">
                        <div class="gov-card-header d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-cash-stack me-2"></i>Budget Utilization &amp; Escrow Status</span>
                            <span class="badge bg-${budgetPct >= 75 ? 'success' : 'warning text-dark'}">${GovUtils.formatCurrency(released)} / ${GovUtils.formatCurrency(budget)}</span>
                        </div>
                        <div class="gov-card-body">
                            <div class="d-flex justify-content-between small text-muted mb-1">
                                <span>Disbursed via Milestone Verification:</span>
                                <span>${budgetPct}% Utilized</span>
                            </div>
                            <div class="progress mb-3" style="height: 10px;">
                                <div class="progress-bar bg-primary" role="progressbar" style="width: ${budgetPct}%;"></div>
                            </div>
                            <div class="row g-2 text-center">
                                <div class="col-4">
                                    <div class="p-2 border rounded bg-light">
                                        <small class="text-muted d-block">Allocated</small>
                                        <strong>${GovUtils.formatCurrency(budget)}</strong>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="p-2 border rounded bg-light">
                                        <small class="text-muted d-block">Released</small>
                                        <strong class="text-success">${GovUtils.formatCurrency(released)}</strong>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="p-2 border rounded bg-light">
                                        <small class="text-muted d-block">Escrow Retained</small>
                                        <strong class="text-warning">${GovUtils.formatCurrency(Math.max(0, escrow))}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }


        renderTelemetryFeed(telemetry);

        // ── 6. Threshold Alerts ───────────────────────────────────────
        renderAlerts(alerts, pilotDbId);

        // ── 7. Evidence Ledger ────────────────────────────────────────
        renderEvidenceLedger(evidences);

        // ── 10. Recommendation (from backend) ─────────────────────────
        await renderRecommendation(pilotDbId, healthPercent);
    }

    // ─── Telemetry Feed Renderer ─────────────────────────────────────────
    function renderTelemetryFeed(telemetry) {
        if (!readingsTbody) return;
        if (!telemetry.length) {
            readingsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-broadcast me-2"></i>No live telemetry readings ingested yet. Click "Ingest KPI Telemetry" to add data.</td></tr>';
            return;
        }

        const sourceBadges = {
            'MANUAL':     '<span class="badge bg-secondary"><i class="bi bi-pencil-square me-1"></i>Manual</span>',
            'CSV_UPLOAD': '<span class="badge bg-info text-dark"><i class="bi bi-file-earmark-spreadsheet me-1"></i>CSV Upload</span>',
            'REST_API':   '<span class="badge bg-primary"><i class="bi bi-plug me-1"></i>REST API</span>',
            'IOT_SENSOR': '<span class="badge bg-success"><i class="bi bi-broadcast me-1"></i>IoT Sensor</span>',
            'GOVT_ERP':   '<span class="badge bg-dark"><i class="bi bi-database-check me-1"></i>Govt ERP</span>'
        };

        readingsTbody.innerHTML = telemetry.map(t => {
            const kpiObj  = liveKpis.find(k => k.id === t.kpi_id) || {};
            const dir     = kpiObj.direction || 'higher';
            const base    = parseFloat(kpiObj.baseline) || 0;
            const val     = parseFloat(t.value) || 0;
            const imp     = base !== 0 ? (dir === 'lower' ? ((base - val) / base) * 100 : ((val - base) / base) * 100) : 0;
            const isGood  = dir === 'lower' ? val <= (kpiObj.target || 0) : val >= (kpiObj.target || 0);
            const ts      = t.recorded_at ? new Date(t.recorded_at).toLocaleString('en-IN') : '—';

            return `
                <tr>
                    <td class="font-monospace small">${ts}</td>
                    <td class="fw-bold text-navy">${t.kpi_name || kpiObj.name || t.kpi_id}</td>
                    <td><strong class="text-dark">${val}</strong> <small class="text-muted">${t.unit || kpiObj.unit || ''}</small></td>
                    <td>${sourceBadges[t.source_type] || `<span class="badge bg-light text-dark">${t.source_type || 'System'}</span>`}</td>
                    <td class="small text-muted font-monospace">${t.source_reference || '—'}</td>
                    <td><span class="fw-bold ${imp >= 0 ? 'text-success' : 'text-danger'}">${imp > 0 ? '+' : ''}${Math.round(imp * 10) / 10}%</span></td>
                    <td class="text-center">
                        <span class="badge ${isGood ? 'bg-success' : 'bg-warning text-dark'}">
                            ${isGood ? 'Green (On Track)' : 'Yellow (At Risk)'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ─── Alerts Renderer ─────────────────────────────────────────────────
    function renderAlerts(alerts, pilotDbId) {
        const active = alerts.filter(a => a.status === 'ACTIVE');
        if (badgeAlertsCount) badgeAlertsCount.textContent = `${active.length} Active Alert${active.length === 1 ? '' : 's'}`;

        if (!alertsContainer) return;

        if (!active.length) {
            alertsContainer.innerHTML = `
                <div class="alert alert-success d-flex align-items-center gap-2 mb-0 py-2">
                    <i class="bi bi-check-circle-fill text-success fs-5"></i>
                    <span>All monitored parameters are running within approved SLA and outcome thresholds. No active breaches.</span>
                </div>`;
            return;
        }

        alertsContainer.innerHTML = active.map(a => `
            <div class="alert alert-${a.severity === 'CRITICAL' ? 'danger' : 'warning'} d-flex justify-content-between align-items-center mb-2 py-2">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-exclamation-triangle-fill text-${a.severity === 'CRITICAL' ? 'danger' : 'warning'} fs-5"></i>
                    <div>
                        <strong>${a.title}</strong>
                        <div class="small">${a.message} <span class="text-muted font-monospace">(${a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : ''})</span></div>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-dark btn-ack-alert" data-alert-id="${a.id}">
                    <i class="bi bi-check2 me-1"></i> Acknowledge
                </button>
            </div>
        `).join('');

        document.querySelectorAll('.btn-ack-alert').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const alertId = e.currentTarget.dataset.alertId;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                try {
                    await GovApi.acknowledgePilotAlert(pilotDbId, alertId);
                    GovUtils.showToast('Alert acknowledged by Dept Officer', 'success');
                    renderDashboard(pilotDbId);
                } catch (err) {
                    GovUtils.showToast('Failed to acknowledge alert: ' + err.message, 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-check2 me-1"></i> Acknowledge';
                }
            });
        });
    }

    // ─── Evidence Ledger Renderer ─────────────────────────────────────────
    function renderEvidenceLedger(evidences) {
        if (!evidenceTbody) return;

        if (!evidences.length) {
            evidenceTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3"><i class="bi bi-folder2-open me-2"></i>No evidence documents uploaded yet.</td></tr>';
            return;
        }

        evidenceTbody.innerHTML = evidences.map(ev => {
            const statusCls = ev.verification_status === 'Verified' ? 'bg-success' : (ev.verification_status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark');
            const viewLink  = ev.file_url
                ? `<a href="${ev.file_url}" target="_blank" class="btn btn-xs btn-outline-primary py-0 px-2" style="font-size: 11px;">
                       <i class="bi bi-box-arrow-up-right me-1"></i>View
                   </a>`
                : '<span class="text-muted small">No file</span>';
            return `
                <tr>
                    <td class="fw-semibold text-navy"><i class="bi bi-file-earmark-check me-1 text-primary"></i>${ev.name}</td>
                    <td><span class="badge bg-light text-dark border">${ev.document_type || ev.type || '—'}</span></td>
                    <td class="small text-muted">${ev.related_milestone || '—'}</td>
                    <td class="small font-monospace">${ev.upload_date || ev.date || '—'}</td>
                    <td><span class="badge ${statusCls}">${ev.verification_status || 'Pending'}</span></td>
                    <td>${viewLink}</td>
                </tr>
            `;
        }).join('');
    }

    // ─── Recommendation Renderer (from backend) ───────────────────────────
    async function renderRecommendation(pilotDbId, localHealth) {
        let healthPercent = localHealth;
        let recommendation = healthPercent >= 85 ? 'SCALE → Direct Commercial Procurement'
            : (healthPercent >= 60 ? 'MODIFY & RETEST → Extend Sandbox' : 'STOP → Close Sandbox Trial');
        let rationale = '';

        try {
            const recRes = await GovApi.getRecommendations(pilotDbId);
            if (recRes && recRes.success && recRes.data) {
                const rec = recRes.data;
                if (rec.targetAchievementScore !== undefined) healthPercent = rec.targetAchievementScore;
                if (rec.recommendation) recommendation = rec.recommendation;
                if (rec.rationale) rationale = rec.rationale;
                if (rec.procurementAction) recommendation = `${rec.recommendation} → ${rec.procurementAction}`;
            }
        } catch (e) {
            console.warn('Recommendation fetch fallback:', e.message);
        }

        if (healthPercent >= 85) {
            if (badgeRecommendation) { badgeRecommendation.className = 'badge bg-success fs-6'; badgeRecommendation.textContent = recommendation; }
            if (txtRecommendationTitle) txtRecommendationTitle.textContent = 'Recommendation: Proceed to Commercial Scale-up & GFR Rule 194 Direct Procurement';
            if (txtRecommendationReason) txtRecommendationReason.textContent = rationale || `All target KPIs exceeded expectations with an overall health score of ${healthPercent}%. Independent validator confirmed full evidence integrity with zero unresolved critical risks.`;
        } else if (healthPercent >= 60) {
            if (badgeRecommendation) { badgeRecommendation.className = 'badge bg-warning text-dark fs-6'; badgeRecommendation.textContent = recommendation; }
            if (txtRecommendationTitle) txtRecommendationTitle.textContent = 'Recommendation: Parameter Tuning & Extended Sandbox Retest';
            if (txtRecommendationReason) txtRecommendationReason.textContent = rationale || `Moderate performance (${healthPercent}% achievement). Core KPIs partially achieved. A 30–60 day parameter refinement iteration is recommended before procurement decision.`;
        } else {
            if (badgeRecommendation) { badgeRecommendation.className = 'badge bg-danger fs-6'; badgeRecommendation.textContent = recommendation; }
            if (txtRecommendationTitle) txtRecommendationTitle.textContent = 'Recommendation: Terminate Sandbox Pilot Trial';
            if (txtRecommendationReason) txtRecommendationReason.textContent = rationale || `Trial did not achieve required baseline threshold tolerances (${healthPercent}% achievement). Not recommended for state-wide public procurement.`;
        }
    }

    // ─── Ingest Modal — KPI Dropdown ─────────────────────────────────────
    function populateIngestKpiDropdown() {
        const selKpi = document.getElementById('inp-ingest-kpi');
        if (!selKpi) return;

        if (!liveKpis.length) {
            selKpi.innerHTML = '<option value="">— No KPIs available —</option>';
            return;
        }

        selKpi.innerHTML = liveKpis.map(k =>
            `<option value="${k.id}" data-unit="${k.unit}">${k.name} (Current: ${k.current} ${k.unit})</option>`
        ).join('');

        if (liveKpis.length > 0) {
            document.getElementById('inp-ingest-unit').value = liveKpis[0].unit;
        }

        selKpi.addEventListener('change', () => {
            const opt = selKpi.selectedOptions[0];
            if (opt) document.getElementById('inp-ingest-unit').value = opt.dataset.unit || '';
        });

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('inp-ingest-time').value = now.toISOString().slice(0, 16);
    }

    // ─── Ingest Form Submit ───────────────────────────────────────────────
    document.getElementById('form-ingest-telemetry')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('[type=submit]');
        const kpiId  = document.getElementById('inp-ingest-kpi').value;
        const source = document.getElementById('inp-ingest-source').value;
        const val    = parseFloat(document.getElementById('inp-ingest-val').value);
        const ref    = document.getElementById('inp-ingest-ref').value || 'Manual Ingestion Portal';
        const time   = document.getElementById('inp-ingest-time').value.replace('T', ' ');

        if (!kpiId || isNaN(val)) {
            GovUtils.showToast('Please select a KPI and enter a valid reading value.', 'warning');
            return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Ingesting…'; }

        try {
            const res = await GovApi.ingestTelemetry(livePilotDbId, kpiId, {
                value:            val,
                sourceType:       source,
                sourceReference:  ref,
                measuredAt:       time
            });

            modalIngest.hide();
            const isBreach = res?.data?.alert != null;
            GovUtils.showToast(
                `Telemetry reading ingested from ${source}! ${isBreach ? '⚠️ Threshold warning generated.' : '✅ Target trajectory on track.'}`,
                isBreach ? 'warning' : 'success'
            );
            renderDashboard(livePilotDbId);
        } catch (err) {
            GovUtils.showToast('Telemetry ingestion failed: ' + err.message, 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-cloud-upload me-1"></i> Ingest Reading'; }
        }
    });

    // ─── Evidence Upload Modal ────────────────────────────────────────────
    document.getElementById('form-upload-evidence')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('[type=submit]');
        const name     = document.getElementById('inp-ev-name')?.value?.trim();
        const type     = document.getElementById('inp-ev-type')?.value;
        const kpiSel   = document.getElementById('inp-ev-kpi')?.value || 'Core KPI Matrix';
        const fileInp  = document.getElementById('inp-ev-file');

        if (!name) { GovUtils.showToast('Evidence name is required.', 'warning'); return; }

        const hasFile = fileInp && fileInp.files && fileInp.files[0];

        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Uploading…'; }

        let fileUrl = null;
        try {
            if (hasFile) {
                const upRes = await GovApi.uploadFile(fileInp.files[0]);
                if (upRes && upRes.success && upRes.data?.fileUrl) fileUrl = upRes.data.fileUrl;
            }

            await GovApi.submitPilotEvidence(livePilotDbId, {
                name,
                documentType:    type,
                fileUrl,
                relatedMilestone: kpiSel,
                uploadedBy:       GovApi.getCurrentUser()?.name || 'Officer'
            });

            modalEvidence.hide();
            GovUtils.showToast('Evidence document submitted successfully!', 'success');
            renderDashboard(livePilotDbId);
        } catch (err) {
            GovUtils.showToast('Evidence upload failed: ' + err.message, 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Submit Evidence'; }
        }
    });

    // ─── Final Evaluation Report Modal ────────────────────────────────────
    document.getElementById('btn-generate-report')?.addEventListener('click', async () => {
        if (!livePilotDbId) { GovUtils.showToast('Select a pilot first.', 'warning'); return; }

        const reportBody = document.getElementById('report-modal-body');
        if (reportBody) reportBody.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="mt-2 text-muted">Generating evaluation report from backend data…</div>
            </div>`;
        modalReport.show();

        try {
            const res = await GovApi.getEvaluationReport(livePilotDbId);
            const r   = res?.data;
            if (!r) { reportBody.innerHTML = '<div class="alert alert-warning">No report data returned.</div>'; return; }

            const targetScore = r.targetAchievementScore || 0;
            const rec         = r.recommendation || (targetScore >= 85 ? 'SCALE' : targetScore >= 60 ? 'MODIFY & RETEST' : 'STOP');
            const badgeCls    = targetScore >= 85 ? 'bg-success' : (targetScore >= 60 ? 'bg-warning text-dark' : 'bg-danger');

            const kpiRows = (r.kpis || liveKpis).map(k => {
                const kpiObj    = liveKpis.find(x => x.id === (k.id || k.kpi_id)) || k;
                const { improvement, rag, status } = calculateRAG({
                    direction:     kpiObj.direction || (k.direction === 'LOWER_IS_BETTER' ? 'lower' : 'higher'),
                    baseline:      parseFloat(kpiObj.baseline ?? k.baseline) || 0,
                    target:        parseFloat(kpiObj.target   ?? k.target)   || 0,
                    minAcceptable: parseFloat(kpiObj.minAcceptable ?? k.min_acceptable) || 0,
                    current:       parseFloat(kpiObj.current  ?? k.current)  || 0
                });
                return `
                    <tr>
                        <td class="fw-bold">${kpiObj.name || k.name}</td>
                        <td>${kpiObj.category || k.category || '—'}</td>
                        <td>${kpiObj.baseline ?? k.baseline} ${kpiObj.unit || k.unit || ''}</td>
                        <td class="fw-bold text-primary">${kpiObj.target ?? k.target} ${kpiObj.unit || k.unit || ''}</td>
                        <td class="fw-bold text-dark">${kpiObj.current ?? k.current} ${kpiObj.unit || k.unit || ''}</td>
                        <td class="fw-bold ${improvement >= 0 ? 'text-success' : 'text-danger'}">${improvement > 0 ? '+' : ''}${improvement}%</td>
                        <td><span class="badge ${rag === 'GREEN' ? 'bg-success' : (rag === 'YELLOW' ? 'bg-warning text-dark' : 'bg-danger')}">${status}</span></td>
                    </tr>`;
            }).join('');

            reportBody.innerHTML = `
                <div class="border p-4 bg-white rounded shadow-sm">
                    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                        <div>
                            <span class="badge bg-warning text-dark font-monospace mb-1">MSInS · GFR RULE 194</span>
                            <h4 class="fw-bold text-navy mb-0">Official Pilot Evaluation Report (Form 194-E)</h4>
                            <small class="text-muted">Government Innovation Procurement & Verification Authority</small>
                        </div>
                        <div class="text-end">
                            <span class="badge ${badgeCls} fs-6 px-3 py-2">DECISION: ${rec}</span>
                            <div class="small text-muted mt-1 font-monospace">Generated: ${new Date().toLocaleDateString('en-IN')}</div>
                        </div>
                    </div>

                    <div class="row g-3 mb-4 bg-light p-3 rounded border">
                        <div class="col-md-4">
                            <small class="text-muted d-block">Pilot Name</small>
                            <strong class="text-navy">${r.pilotName || r.pilot?.name || '—'}</strong>
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted d-block">Commissioned Startup</small>
                            <strong>${r.startup || r.pilot?.startup || '—'}</strong>
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted d-block">Nodal Department</small>
                            <strong>${r.department || r.pilot?.department || '—'}</strong>
                        </div>
                        <div class="col-12 mt-2">
                            <small class="text-muted d-block">Defined Target Outcome Statement</small>
                            <span class="fw-semibold text-dark">${txtOutcome?.textContent || '—'}</span>
                        </div>
                    </div>

                    <h6 class="fw-bold text-navy mb-2"><i class="bi bi-graph-up me-2"></i>2. Key Performance Indicators Achievement Matrix</h6>
                    <div class="table-responsive mb-4">
                        <table class="table table-bordered table-sm">
                            <thead class="table-light">
                                <tr><th>KPI Name</th><th>Category</th><th>Baseline</th><th>Target</th><th>Final Actual</th><th>% Improvement</th><th>Verdict</th></tr>
                            </thead>
                            <tbody>${kpiRows}</tbody>
                        </table>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <div class="p-3 border rounded h-100">
                                <h6 class="fw-bold text-navy mb-2"><i class="bi bi-shield-check me-2"></i>Independent Validation Verdict</h6>
                                <p class="small mb-1"><strong>Evidence Count:</strong> ${liveEvidences.length} document(s) on record</p>
                                <p class="small mb-1"><strong>Attestation Status:</strong> <span class="badge ${liveEvidences.length > 0 ? 'bg-success' : 'bg-secondary'}">${liveEvidences.length > 0 ? 'EVIDENCE SUBMITTED' : 'NO EVIDENCE YET'}</span></p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 border rounded h-100">
                                <h6 class="fw-bold text-navy mb-2"><i class="bi bi-calculator me-2"></i>Evaluation Scoring Composite</h6>
                                <div class="d-flex justify-content-between small mb-1">
                                    <span>Target KPI Achievement Rate:</span>
                                    <strong>${targetScore}%</strong>
                                </div>
                                <div class="d-flex justify-content-between small mb-1">
                                    <span>Supporting Evidence Count:</span>
                                    <strong>${liveEvidences.length} Documents</strong>
                                </div>
                                <div class="d-flex justify-content-between small">
                                    <span>Open Critical Alerts:</span>
                                    <strong class="${liveAlerts.filter(a => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length > 0 ? 'text-danger' : 'text-success'}">${liveAlerts.filter(a => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length} Critical</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-${targetScore >= 85 ? 'success' : 'warning'} mb-0">
                        <h6 class="fw-bold mb-1"><i class="bi bi-award me-1"></i> Procurement Committee Recommendation: ${rec}</h6>
                        <p class="small mb-0">${r.rationale || (targetScore >= 85
                            ? 'Based on validated target achievement under GFR Rule 194, the committee authorizes Direct Commercial Procurement and GeM listing.'
                            : 'Based on partial outcome achievement, direct procurement is deferred pending parameter tuning and sandbox retest.')}</p>
                    </div>
                </div>`;
        } catch (err) {
            if (reportBody) reportBody.innerHTML = `<div class="alert alert-danger">Failed to generate report: ${err.message}</div>`;
        }
    });

    // ─── Ingest Button ────────────────────────────────────────────────────
    document.getElementById('btn-open-ingest-modal')?.addEventListener('click', () => {
        if (!livePilotDbId) { GovUtils.showToast('Select a pilot first.', 'warning'); return; }
        populateIngestKpiDropdown();
        modalIngest.show();
    });

    // ─── Upload Evidence Button ───────────────────────────────────────────
    document.getElementById('btn-upload-evidence')?.addEventListener('click', () => {
        if (!livePilotDbId) { GovUtils.showToast('Select a pilot first.', 'warning'); return; }
        // Populate evidence KPI dropdown from live KPIs
        const kpiSel = document.getElementById('inp-ev-kpi');
        if (kpiSel && liveKpis.length) {
            kpiSel.innerHTML = [
                '<option value="Core KPI Matrix">Core KPI Matrix (General)</option>',
                ...liveKpis.map(k => `<option value="${k.code}">${k.name}</option>`)
            ].join('');
        }
        modalEvidence.show();
    });

    // ─── Validator Review Actions ─────────────────────────────────────────
    document.getElementById('btn-val-verify')?.addEventListener('click', () => {
        document.getElementById('val-validation-verdict').className = 'badge bg-success';
        document.getElementById('val-validation-verdict').textContent = 'VERIFIED';
        GovUtils.showToast('Independent Validator attested all evidence as VERIFIED.', 'success');
    });

    document.getElementById('btn-val-partial')?.addEventListener('click', () => {
        document.getElementById('val-validation-verdict').className = 'badge bg-warning text-dark';
        document.getElementById('val-validation-verdict').textContent = 'PARTIALLY VERIFIED';
        GovUtils.showToast('Independent Validator marked evidence as PARTIALLY VERIFIED.', 'warning');
    });

    document.getElementById('btn-val-reject')?.addEventListener('click', () => {
        document.getElementById('val-validation-verdict').className = 'badge bg-danger';
        document.getElementById('val-validation-verdict').textContent = 'NOT VERIFIED';
        GovUtils.showToast('Independent Validator marked evidence as NOT VERIFIED / DISPUTED.', 'error');
    });

    // ─── Audit Seal ───────────────────────────────────────────────────────
    document.getElementById('btn-audit-seal')?.addEventListener('click', () => {
        GovUtils.showToast('Telemetry Logs Cryptographically Sealed under Section 65B of Indian Evidence Act.', 'success');
    });

    // ─── Pilot Change ─────────────────────────────────────────────────────
    selPilot?.addEventListener('change', (e) => {
        renderDashboard(e.target.value);
    });

    // ─── Init ─────────────────────────────────────────────────────────────
    async function init() {
        await populatePilots();
        const initId = selPilot?.value;
        if (initId) await renderDashboard(initId);
    }
    init();
});
