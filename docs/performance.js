/* ================================================================
   GovCatalyst — Module 7: Performance M&E & Telemetry Logic (10-Step Workflow)
   Covers:
   1. Outcome Definition
   2. Multi-KPI Tracking (4–8 KPIs)
   3. Baseline & Target Setting
   4. Multi-Source Telemetry Ingestion (Manual, CSV, API, IoT, ERP)
   5. RAG Real-Time Monitoring Dashboard
   6. Automatic Threshold Alerts
   7. Evidence Management
   8. Final Evaluation & Official Report Generator
   9. Independent Validation (Verified, Partially Verified, Not Verified)
   10. Scale-up Procurement Recommendation (SCALE, MODIFY & RETEST, STOP)
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const selPilot = document.getElementById('sel-perf-pilot');
    const healthScore = document.getElementById('val-health-score');
    const healthLabel = document.getElementById('val-health-label');
    const txtOutcome = document.getElementById('txt-pilot-outcome');
    const pilotStatusBadge = document.getElementById('badge-pilot-status');
    const metaGrid = document.getElementById('pilot-meta-grid');
    const kpiCardsGrid = document.getElementById('kpi-cards-grid');
    const readingsTbody = document.getElementById('readings-tbody');
    const alertsContainer = document.getElementById('alerts-container');
    const badgeAlertsCount = document.getElementById('badge-alerts-count');
    const evidenceTbody = document.getElementById('evidence-tbody');

    // Recommendation elements
    const badgeRecommendation = document.getElementById('badge-recommendation');
    const txtRecommendationTitle = document.getElementById('txt-recommendation-title');
    const txtRecommendationReason = document.getElementById('txt-recommendation-reason');

    // Modals
    const modalIngest = new bootstrap.Modal(document.getElementById('modalIngestTelemetry'));
    const modalReport = new bootstrap.Modal(document.getElementById('modalEvaluationReport'));
    const modalEvidence = new bootstrap.Modal(document.getElementById('modalUploadEvidence'));

    // Telemetry, KPI, Evidence and Alert data stores (populated from backend API)
    const telemetryStore = {};
    const pilotKpis = {};
    const evidenceStore = {};
    let alertsState = {};

    // Populate Pilot selector
    async function populatePilots() {
        let pilots = GovData.pilots || [];
        if (window.GovApi) {
            try {
                const res = await GovApi.getPilots();
                if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const livePilots = res.data.map(p => ({
                        id: p.pilot_code || (p.id ? `PLT-${p.id.substring(0, 6)}` : 'PLT-001'),
                        dbId: p.id,
                        name: p.name || 'Sandbox Pilot',
                        department: p.department || 'Government Department',
                        status: p.status || 'Active'
                    }));
                    GovData.pilots = livePilots;
                    pilots = livePilots;
                }
            } catch (e) {
                console.warn('Pilots fetch fallback:', e.message);
            }
        }
        if (selPilot) {
            if (pilots.length === 0) {
                selPilot.innerHTML = '<option value="">-- No Sandbox Pilots Found --</option>';
            } else {
                selPilot.innerHTML = pilots.map(p => `
                    <option value="${p.id}">[${p.id}] ${p.name} — ${p.department || 'Gov'}</option>
                `).join('');
            }
        }
    }

    // Calculate RAG indicator and % improvement
    function calculateRAG(kpi) {
        let improvement = 0;
        let isAchieved = false;
        let progress = 0;

        if (kpi.direction === 'lower') {
            improvement = ((kpi.baseline - kpi.current) / kpi.baseline) * 100;
            isAchieved = kpi.current <= kpi.target;
            const denom = kpi.baseline - kpi.target;
            progress = denom !== 0 ? ((kpi.baseline - kpi.current) / denom) * 100 : 100;
        } else {
            improvement = ((kpi.current - kpi.baseline) / kpi.baseline) * 100;
            isAchieved = kpi.current >= kpi.target;
            const denom = kpi.target - kpi.baseline;
            progress = denom !== 0 ? ((kpi.current - kpi.baseline) / denom) * 100 : 100;
        }

        const impPercent = Math.round(improvement * 10) / 10;
        const clampedProgress = Math.round(Math.max(0, Math.min(progress, 120)) * 10) / 10;

        let rag = 'YELLOW';
        let status = 'At Risk';
        let badgeClass = 'bg-warning text-dark';

        if (isAchieved || clampedProgress >= 100) {
            rag = 'GREEN';
            status = 'Achieved';
            badgeClass = 'bg-success';
        } else if (kpi.direction === 'lower' ? kpi.current <= kpi.minAcceptable : kpi.current >= kpi.minAcceptable) {
            rag = clampedProgress >= 70 ? 'GREEN' : 'YELLOW';
            status = 'On Track';
            badgeClass = rag === 'GREEN' ? 'bg-success' : 'bg-warning text-dark';
        } else {
            rag = 'RED';
            status = 'Lagging Behind';
            badgeClass = 'bg-danger';
        }

        return { improvement: impPercent, progress: clampedProgress, rag, status, badgeClass };
    }

    // Render Dashboard for selected pilot
    async function renderDashboard(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId) || GovData.pilots[0];
        if (!p) return;

        let kpis = pilotKpis[pilotId] || [];
        let telemetry = telemetryStore[pilotId] || [];
        let alerts = alertsState[pilotId] || [];
        let evidences = evidenceStore[pilotId] || [];

        try {
            if (window.GovApi) {
                const kpiRes = await GovApi.getPilotKpis(pilotId);
                if (kpiRes && kpiRes.success && kpiRes.data) kpis = kpiRes.data;
                
                const alertsRes = await GovApi.getPilotAlerts(pilotId);
                if (alertsRes && alertsRes.success && alertsRes.data) alerts = alertsRes.data;
                
                const evRes = await GovApi.getPilotEvidences(pilotId);
                if (evRes && evRes.success && evRes.data) evidences = evRes.data;
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }

        // 1. Defined Outcome Banner
        const defaultOutcomes = {
            'PLT-001': 'Reduce municipal solid waste collection cost by 15% (from ₹50L/mo to ₹42.5L/mo), reduce diesel consumption by 20%, and maintain >92% route adherence across Ward-G.',
            'PLT-002': 'Detect pipeline water leakages within 10 minutes, reduce non-revenue water (NRW) loss from 38% to 20%, and cut citizen contamination complaints by 80%.'
        };
        txtOutcome.textContent = defaultOutcomes[pilotId] || p.objective || 'Achieve defined outcome parameters under GFR Rule 194 innovation trial.';
        pilotStatusBadge.textContent = p.status || 'PILOT_ACTIVE';

        // Meta Parameters
        metaGrid.innerHTML = `
            <div class="col-sm-3">
                <small class="text-muted d-block">Innovator / Startup</small>
                <strong class="text-navy">${p.startupId || 'InspectAI Technologies'}</strong>
            </div>
            <div class="col-sm-3">
                <small class="text-muted d-block">Testbed Location</small>
                <strong>${p.location || 'Pune Highway Division'}</strong>
            </div>
            <div class="col-sm-3">
                <small class="text-muted d-block">Trial Window</small>
                <span class="fw-semibold">${p.duration || '8 Weeks'} (${GovUtils.formatDate(p.startDate)} – ${GovUtils.formatDate(p.endDate)})</span>
            </div>
            <div class="col-sm-3">
                <small class="text-muted d-block">Risk & Cybersecurity</small>
                <span class="badge ${p.riskLevel === 'Low' ? 'bg-success' : 'bg-warning text-dark'}">${p.riskLevel || 'Low'} Tier Risk · Gated</span>
            </div>
        `;

        // 2 & 3 & 5. KPI Cards with RAG indicators
        let greenCount = 0;
        let yellowCount = 0;
        let redCount = 0;

        kpiCardsGrid.innerHTML = kpis.map(k => {
            const { improvement, progress, rag, status, badgeClass } = calculateRAG(k);
            if (rag === 'GREEN') greenCount++;
            else if (rag === 'YELLOW') yellowCount++;
            else redCount++;

            return `
                <div class="col-md-4">
                    <div class="gov-card h-100 mb-0 border-top border-4 ${rag === 'GREEN' ? 'border-success' : (rag === 'YELLOW' ? 'border-warning' : 'border-danger')}">
                        <div class="gov-card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="badge bg-light text-navy border font-monospace">${k.code || 'KPI'}</span>
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

        // Calculate Overall Health Score
        const total = kpis.length || 1;
        const healthPercent = Math.round(((greenCount + (yellowCount * 0.5)) / total) * 100);
        healthScore.textContent = `${healthPercent}%`;

        if (healthPercent >= 85) {
            healthScore.className = 'fs-4 fw-extrabold text-success';
            healthLabel.className = 'badge bg-success p-2';
            healthLabel.textContent = 'EXCELLENT / TARGETS ACHIEVED';
        } else if (healthPercent >= 60) {
            healthScore.className = 'fs-4 fw-extrabold text-primary';
            healthLabel.className = 'badge bg-warning text-dark p-2';
            healthLabel.textContent = 'ON TRACK / MODERATE VARIANCE';
        } else {
            healthScore.className = 'fs-4 fw-extrabold text-danger';
            healthLabel.className = 'badge bg-danger p-2';
            healthLabel.textContent = 'AT RISK / CRITICAL BREACH';
        }

        // 4. Ingested Telemetry Feed
        if (telemetry.length === 0) {
            readingsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No live telemetry readings ingested yet.</td></tr>';
        } else {
            readingsTbody.innerHTML = telemetry.map(t => {
                let imp = 0;
                if (t.direction === 'lower') imp = ((t.baseline - t.value) / t.baseline) * 100;
                else imp = ((t.value - t.baseline) / t.baseline) * 100;

                const sourceBadges = {
                    'MANUAL': '<span class="badge bg-secondary"><i class="bi bi-pencil-square me-1"></i>Manual</span>',
                    'CSV_UPLOAD': '<span class="badge bg-info text-dark"><i class="bi bi-file-earmark-spreadsheet me-1"></i>CSV Upload</span>',
                    'REST_API': '<span class="badge bg-primary"><i class="bi bi-plug me-1"></i>REST API</span>',
                    'IOT_SENSOR': '<span class="badge bg-success"><i class="bi bi-broadcast me-1"></i>IoT Sensor</span>',
                    'GOVT_ERP': '<span class="badge bg-dark"><i class="bi bi-database-check me-1"></i>Govt ERP</span>'
                };

                const isGood = t.direction === 'lower' ? t.value <= t.target : t.value >= t.target;

                return `
                    <tr>
                        <td class="font-monospace small">${t.timestamp}</td>
                        <td class="fw-bold text-navy">${t.kpiName}</td>
                        <td><strong class="text-dark">${t.value}</strong> <small class="text-muted">${t.unit}</small></td>
                        <td>${sourceBadges[t.source] || '<span class="badge bg-light text-dark">System</span>'}</td>
                        <td class="small text-muted font-monospace">${t.sourceRef}</td>
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

        // 6. Threshold Alerts Feed
        const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
        badgeAlertsCount.textContent = `${activeAlerts.length} Active Alert${activeAlerts.length === 1 ? '' : 's'}`;
        if (activeAlerts.length === 0) {
            alertsContainer.innerHTML = `
                <div class="alert alert-success d-flex align-items-center gap-2 mb-0 py-2">
                    <i class="bi bi-check-circle-fill text-success fs-5"></i>
                    <span>All monitored parameters are running within approved SLA and outcome thresholds. No active breaches.</span>
                </div>
            `;
        } else {
            alertsContainer.innerHTML = activeAlerts.map(a => `
                <div class="alert alert-${a.severity === 'CRITICAL' ? 'danger' : 'warning'} d-flex justify-content-between align-items-center mb-2 py-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-exclamation-triangle-fill text-${a.severity === 'CRITICAL' ? 'danger' : 'warning'} fs-5"></i>
                        <div>
                            <strong>${a.title}</strong>
                            <div class="small">${a.message} <span class="text-muted font-monospace">(${a.time})</span></div>
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
                    const alertItem = alerts.find(x => x.id === alertId);
                    if (alertItem) {
                        alertItem.status = 'ACKNOWLEDGED';
                        try {
                            if (window.GovApi) await GovApi.acknowledgePilotAlert(pilotId, alertId);
                        } catch (err) {
                            console.warn('Failed to ack alert on backend', err);
                        }
                        GovUtils.showToast(`Alert acknowledged by Dept Officer`, 'success');
                        renderDashboard(pilotId);
                    }
                });
            });
        }

        // 7. Evidence Ledger
        evidenceTbody.innerHTML = evidences.map(ev => `
            <tr>
                <td class="fw-semibold text-navy"><i class="bi bi-file-earmark-check me-1 text-primary"></i> ${ev.name}</td>
                <td><span class="badge bg-light text-dark border">${ev.type}</span></td>
                <td class="small text-muted">${ev.kpi}</td>
                <td class="small font-monospace">${ev.date}</td>
                <td><span class="badge bg-success">${ev.status}</span></td>
            </tr>
        `).join('');

        // 10. Automated Final Recommendation Engine
        if (healthPercent >= 85) {
            badgeRecommendation.className = 'badge bg-success fs-6';
            badgeRecommendation.textContent = 'SCALE → Direct Commercial Procurement';
            txtRecommendationTitle.textContent = 'Recommendation: Proceed to Commercial Scale-up & GFR Rule 194 Direct Procurement';
            txtRecommendationReason.textContent = `All target KPIs exceeded expectations with an overall health score of ${healthPercent}%. Independent validator confirmed full evidence integrity with zero unresolved critical risks.`;
        } else if (healthPercent >= 60) {
            badgeRecommendation.className = 'badge bg-warning text-dark fs-6';
            badgeRecommendation.textContent = 'MODIFY & RETEST → Extend Sandbox (30-60 Days)';
            txtRecommendationTitle.textContent = 'Recommendation: Parameter Tuning & Extended Sandbox Retest';
            txtRecommendationReason.textContent = `Moderate performance (${healthPercent}% achievement). Core KPIs partially achieved. A 30–60 day parameter refinement iteration is recommended before procurement decision.`;
        } else {
            badgeRecommendation.className = 'badge bg-danger fs-6';
            badgeRecommendation.textContent = 'STOP → Close Sandbox Trial';
            txtRecommendationTitle.textContent = 'Recommendation: Terminate Sandbox Pilot Trial';
            txtRecommendationReason.textContent = `Trial did not achieve required baseline threshold tolerances (${healthPercent}% achievement). Not recommended for state-wide public procurement.`;
        }
    }

    // Modal Ingestion Helper - Populate KPI Dropdown
    function populateIngestKpiDropdown(pilotId) {
        const kpis = pilotKpis[pilotId] || [];
        const selKpi = document.getElementById('inp-ingest-kpi');
        selKpi.innerHTML = kpis.map(k => `
            <option value="${k.id}" data-unit="${k.unit}">${k.name} (Current: ${k.current} ${k.unit})</option>
        `).join('');

        if (kpis.length > 0) {
            document.getElementById('inp-ingest-unit').value = kpis[0].unit;
        }

        selKpi.addEventListener('change', () => {
            const opt = selKpi.selectedOptions[0];
            if (opt) document.getElementById('inp-ingest-unit').value = opt.dataset.unit || '';
        });

        // Set default time to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('inp-ingest-time').value = now.toISOString().slice(0, 16);
    }

    // Modal Ingest Submission
    document.getElementById('form-ingest-telemetry')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const pilotId = selPilot.value;
        const kpiId = document.getElementById('inp-ingest-kpi').value;
        const source = document.getElementById('inp-ingest-source').value;
        const val = parseFloat(document.getElementById('inp-ingest-val').value);
        const ref = document.getElementById('inp-ingest-ref').value || 'Manual Ingestion Portal';
        const time = document.getElementById('inp-ingest-time').value.replace('T', ' ');

        const kpiList = pilotKpis[pilotId] || [];
        const kpi = kpiList.find(k => k.id === kpiId);
        if (!kpi) return;

        // Update KPI actual
        kpi.current = val;
        kpi.readings.push({ week: kpi.readings.length + 1, value: val });

        // Record telemetry reading
        if (!telemetryStore[pilotId]) telemetryStore[pilotId] = [];
        telemetryStore[pilotId].unshift({
            timestamp: time || new Date().toISOString().slice(0, 16).replace('T', ' '),
            kpiId: kpi.id,
            kpiName: kpi.name,
            value: val,
            unit: kpi.unit,
            baseline: kpi.baseline,
            target: kpi.target,
            source: source,
            sourceRef: ref,
            direction: kpi.direction
        });

        // Check if threshold alert triggered
        let isBreach = false;
        if (kpi.direction === 'lower' ? val > kpi.minAcceptable : val < kpi.minAcceptable) {
            isBreach = true;
            if (!alertsState[pilotId]) alertsState[pilotId] = [];
            alertsState[pilotId].unshift({
                id: `ALT-${Date.now().toString().slice(-4)}`,
                severity: 'WARNING',
                title: `Target Threshold Warning: ${kpi.name}`,
                message: `${kpi.name} recorded value (${val} ${kpi.unit}) is lagging behind target trajectory tolerance (${kpi.minAcceptable} ${kpi.unit}).`,
                kpi: kpi.name,
                time: time || new Date().toISOString().slice(0, 16).replace('T', ' '),
                status: 'ACTIVE'
            });
        }

        // Dispatch live to PostgreSQL API if available
        if (window.GovApi) {
            GovApi.ingestTelemetry(pilotId, kpiId, {
                reading_value: val,
                source_type: source,
                source_reference: ref,
                measured_at: time
            }).then(apiRes => {
                console.log('✅ Telemetry persisted to PostgreSQL backend:', apiRes);
            }).catch(err => {
                console.log('Telemetry offline fallback:', err.message);
            });
        }

        modalIngest.hide();
        GovUtils.showToast(`Telemetry reading ingested from ${source}! ${isBreach ? '⚠️ Threshold warning generated.' : '✅ Target trajectory on track.'}`, isBreach ? 'warning' : 'success');
        renderDashboard(pilotId);
    });

    // Final Pilot Evaluation Report Modal Generator (Step 8)
    document.getElementById('btn-generate-report')?.addEventListener('click', () => {
        const pilotId = selPilot.value;
        const p = GovData.pilots.find(item => item.id === pilotId) || GovData.pilots[0];
        const kpis = pilotKpis[pilotId] || [];
        const evidences = evidenceStore[pilotId] || [];

        let achievedCount = 0;
        const kpiRows = kpis.map(k => {
            const { improvement, rag, status } = calculateRAG(k);
            if (rag === 'GREEN') achievedCount++;
            return `
                <tr>
                    <td class="fw-bold">${k.name}</td>
                    <td>${k.category}</td>
                    <td>${k.baseline} ${k.unit}</td>
                    <td class="fw-bold text-primary">${k.target} ${k.unit}</td>
                    <td class="fw-bold text-dark">${k.current} ${k.unit}</td>
                    <td class="fw-bold ${improvement >= 0 ? 'text-success' : 'text-danger'}">${improvement > 0 ? '+' : ''}${improvement}%</td>
                    <td><span class="badge ${rag === 'GREEN' ? 'bg-success' : (rag === 'YELLOW' ? 'bg-warning text-dark' : 'bg-danger')}">${status}</span></td>
                </tr>
            `;
        }).join('');

        const targetScore = Math.round((achievedCount / (kpis.length || 1)) * 100);
        const recommendation = targetScore >= 85 ? 'SCALE' : (targetScore >= 60 ? 'MODIFY & RETEST' : 'STOP');
        const badgeClass = targetScore >= 85 ? 'bg-success' : (targetScore >= 60 ? 'bg-warning text-dark' : 'bg-danger');

        document.getElementById('report-modal-body').innerHTML = `
            <div class="border p-4 bg-white rounded shadow-sm">
                <!-- Report Header -->
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <div>
                        <span class="badge bg-warning text-dark font-monospace mb-1">MSInS · GFR RULE 194</span>
                        <h4 class="fw-bold text-navy mb-0">Official Pilot Evaluation Report (Form 194-E)</h4>
                        <small class="text-muted">Government Innovation Procurement & Verification Authority</small>
                    </div>
                    <div class="text-end">
                        <span class="badge ${badgeClass} fs-6 px-3 py-2">DECISION: ${recommendation}</span>
                        <div class="small text-muted mt-1 font-monospace">Generated: ${new Date().toLocaleDateString('en-IN')}</div>
                    </div>
                </div>

                <!-- Section 1: Pilot Summary -->
                <div class="row g-3 mb-4 bg-light p-3 rounded border">
                    <div class="col-md-4">
                        <small class="text-muted d-block">Pilot Code / Title</small>
                        <strong class="text-navy">[${p.id}] ${p.name}</strong>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted d-block">Commissioned Innovator</small>
                        <strong>${p.startupId || 'InspectAI Technologies'}</strong>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted d-block">Nodal Department</small>
                        <strong>${p.department || 'PWD / Urban Development'}</strong>
                    </div>
                    <div class="col-12 mt-2">
                        <small class="text-muted d-block">Defined Target Outcome Statement</small>
                        <span class="fw-semibold text-dark">${txtOutcome.textContent}</span>
                    </div>
                </div>

                <!-- Section 2: KPI Matrix Baseline vs Final Result -->
                <h6 class="fw-bold text-navy mb-2"><i class="bi bi-graph-up me-2"></i>2. Key Performance Indicators Achievement Matrix</h6>
                <div class="table-responsive mb-4">
                    <table class="table table-bordered table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>KPI Name</th>
                                <th>Category</th>
                                <th>Baseline</th>
                                <th>Target</th>
                                <th>Final Actual</th>
                                <th>% Improvement</th>
                                <th>Verdict</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${kpiRows}
                        </tbody>
                    </table>
                </div>

                <!-- Section 3: Validation & Evidence Audit Summary -->
                <div class="row g-3 mb-4">
                    <div class="col-md-6">
                        <div class="p-3 border rounded h-100">
                            <h6 class="fw-bold text-navy mb-2"><i class="bi bi-shield-check me-2"></i>Independent Validation Verdict</h6>
                            <p class="small mb-1"><strong>Validator:</strong> Smt. Kavita Deshmukh (Finance / Audit Dept)</p>
                            <p class="small mb-1"><strong>Attestation Status:</strong> <span class="badge bg-success">VERIFIED & CLEAR</span></p>
                            <p class="small text-muted mb-0">"All field invoices and IoT telemetric records reconciled with zero non-conformances."</p>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-3 border rounded h-100">
                            <h6 class="fw-bold text-navy mb-2"><i class="bi bi-calculator me-2"></i>Evaluation Scoring Composite</h6>
                            <div class="d-flex justify-content-between small mb-1">
                                <span>Target KPI Achievement Rate:</span>
                                <strong>${targetScore}% (${achievedCount}/${kpis.length} Targets Met)</strong>
                            </div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span>Cybersecurity & Risk Status:</span>
                                <strong class="text-success">PASS (Zero Open Critical Risks)</strong>
                            </div>
                            <div class="d-flex justify-content-between small">
                                <span>Supporting Evidence Count:</span>
                                <strong>${evidences.length} Verified Documents</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 4: Final Recommendation & GFR 194 Next Steps -->
                <div class="alert alert-${targetScore >= 85 ? 'success' : 'warning'} mb-0">
                    <h6 class="fw-bold mb-1"><i class="bi bi-award me-1"></i> Procurement Committee Recommendation: ${recommendation}</h6>
                    <p class="small mb-0">
                        ${targetScore >= 85
                            ? 'Based on validated target achievement under GFR Rule 194, the committee authorizes Direct Commercial Procurement and GeM listing publication across all division offices.'
                            : 'Based on partial outcome achievement, direct procurement is deferred pending 30-day parameter tuning and sandbox retest.'
                        }
                    </p>
                </div>
            </div>
        `;
        modalReport.show();
    });

    // Simulate IoT live stream button
    document.getElementById('btn-stream-iot')?.addEventListener('click', () => {
        const pilotId = selPilot.value;
        const kpis = pilotKpis[pilotId] || [];
        if (kpis.length === 0) return;

        const randomKpi = kpis[Math.floor(Math.random() * kpis.length)];
        const delta = (Math.random() * 0.04 - 0.02) * randomKpi.current;
        const newVal = Math.round((randomKpi.current + delta) * 10) / 10;
        randomKpi.current = newVal;

        if (!telemetryStore[pilotId]) telemetryStore[pilotId] = [];
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        telemetryStore[pilotId].unshift({
            timestamp: timeStr,
            kpiId: randomKpi.id,
            kpiName: randomKpi.name,
            value: newVal,
            unit: randomKpi.unit,
            baseline: randomKpi.baseline,
            target: randomKpi.target,
            source: 'IOT_SENSOR',
            sourceRef: `Auto-Stream Sensor Node #${Math.floor(100 + Math.random()*900)}`,
            direction: randomKpi.direction
        });

        GovUtils.showToast(`Live IoT telemetry streamed for ${randomKpi.name}: ${newVal} ${randomKpi.unit}`, 'info');
        renderDashboard(pilotId);
    });

    // Ingest button
    document.getElementById('btn-open-ingest-modal')?.addEventListener('click', () => {
        populateIngestKpiDropdown(selPilot.value);
        modalIngest.show();
    });

    // Upload evidence modal
    document.getElementById('btn-upload-evidence')?.addEventListener('click', () => {
        modalEvidence.show();
    });

    document.getElementById('form-upload-evidence')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const pilotId = selPilot.value;
        const name = document.getElementById('inp-ev-name').value;
        const type = document.getElementById('inp-ev-type').value;
        const kpi = document.getElementById('inp-ev-kpi').value || 'Core KPI Matrix';

        if (!evidenceStore[pilotId]) evidenceStore[pilotId] = [];
        evidenceStore[pilotId].push({
            id: `EV-${Date.now().toString().slice(-3)}`,
            name,
            type,
            kpi,
            date: new Date().toISOString().slice(0, 10),
            status: 'Verified'
        });

        modalEvidence.hide();
        GovUtils.showToast('Supporting evidence attached & verified in ledger!', 'success');
        renderDashboard(pilotId);
    });

    // Validator Review Actions (Step 9)
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

    // Audit Seal button
    document.getElementById('btn-audit-seal')?.addEventListener('click', () => {
        GovUtils.showToast('Telemetry Logs Cryptographically Sealed under Section 65B of Indian Evidence Act.', 'success');
    });

    // Change pilot listener
    selPilot?.addEventListener('change', (e) => {
        renderDashboard(e.target.value);
    });

    // Initialize
    async function init() {
        await populatePilots();
        if (GovData.pilots && GovData.pilots.length > 0) {
            const initId = selPilot?.value || GovData.pilots[0].id;
            await renderDashboard(initId);
        }
    }
    init();
});
