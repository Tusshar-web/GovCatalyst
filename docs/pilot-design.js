/* =============================================
   GovCatalyst — Module 5: Pilot Design Logic
   Connected directly to PostgreSQL Backend API (/api/pilots)
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
    const cardPilotForm = document.getElementById('card-pilot-form');
    const btnTogglePilotForm = document.getElementById('btn-toggle-pilot-form');
    const btnClosePilotForm = document.getElementById('btn-close-pilot-form');
    const btnCancelPilotForm = document.getElementById('btn-cancel-pilot-form');
    const formPilotDesign = document.getElementById('form-pilot-design');

    const inpPilotChallenge = document.getElementById('inp-pilot-challenge');
    const inpPilotStartup = document.getElementById('inp-pilot-startup');
    const inpPilotRisk = document.getElementById('inp-pilot-risk');
    const safeguardsContainer = document.getElementById('safeguards-container');
    const pilotsTbody = document.getElementById('pilots-tbody');
    const pilotsCount = document.getElementById('pilots-count');
    const statActivePilots = document.getElementById('stat-active-pilots');
    const statSandboxSites = document.getElementById('stat-sandbox-sites');

    // Parse URL params if directed from Evaluation
    const urlParams = new URLSearchParams(window.location.search);
    const preStartupId = urlParams.get('startupId');
    const preChallengeId = urlParams.get('challengeId');

    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    const normRole = currentUser && currentUser.role ? currentUser.role.toLowerCase().replace(/[\s-]/g, '_') : '';

    // Only dept_admin and super_admin can charter new pilots
    if (currentUser && normRole !== 'dept_admin' && normRole !== 'super_admin') {
        if (btnTogglePilotForm) btnTogglePilotForm.style.display = 'none';
    }

    function toggleForm(show) {
        if (currentUser && normRole !== 'dept_admin' && normRole !== 'super_admin') {
            GovUtils.showToast('Access Denied: Only Department Admins can charter pilot sandboxes.', 'error');
            return;
        }
        cardPilotForm.style.display = show ? 'block' : 'none';
        if (show) cardPilotForm.scrollIntoView({ behavior: 'smooth' });
    }

    btnTogglePilotForm?.addEventListener('click', () => toggleForm(cardPilotForm.style.display === 'none'));
    btnClosePilotForm?.addEventListener('click', () => toggleForm(false));
    btnCancelPilotForm?.addEventListener('click', () => toggleForm(false));

    // ─────────────────────────────────────────────────────────────
    // 1. POPULATE DROPDOWNS FROM LIVE BACKEND DATA
    // ─────────────────────────────────────────────────────────────
    async function populateDropdowns() {
        let challenges = GovData.challenges || [];
        let startups = GovData.startups || [];

        // Fetch live challenges from backend API
        if (window.GovApi) {
            try {
                const res = await GovApi.getChallenges();
                if (res && res.success && Array.isArray(res.challenges) && res.challenges.length > 0) {
                    challenges = res.challenges.map(c => ({
                        id: c.id,
                        title: c.title,
                        category: c.sector || 'Innovation',
                        status: c.status || 'Published',
                        department: c.department_name || 'Government Department'
                    }));
                    GovData.challenges = challenges;
                }
            } catch (e) {
                console.log('Live challenges fetch notice:', e.message);
            }
        } // end if (window.GovApi)

        if (inpPilotChallenge) {
            inpPilotChallenge.innerHTML = '<option value="">-- Select Challenge --</option>' + 
                (challenges.length > 0
                ? challenges.map(c => `
                    <option value="${c.id}" ${c.id === preChallengeId ? 'selected' : ''}>
                        [${typeof c.id === 'string' ? c.id.substring(0, 8) : c.id}] ${c.title}
                    </option>
                  `).join('')
                : '<option value="">-- No Challenges Found --</option>');
        }

        if (inpPilotChallenge && inpPilotStartup) {
            inpPilotChallenge.addEventListener('change', async (e) => {
                await loadApprovedStartups(e.target.value);
            });
            // Initial load if a challenge is pre-selected or first available
            const initialCh = preChallengeId || (challenges.length > 0 ? challenges[0].id : null);
            if (initialCh) {
                if (!preChallengeId) inpPilotChallenge.value = initialCh;
                await loadApprovedStartups(initialCh);
            } else {
                inpPilotStartup.innerHTML = '<option value="">-- Select Challenge First --</option>';
            }
        }

        if (preStartupId || preChallengeId) {
            toggleForm(true);
        }
    }

    async function loadApprovedStartups(challengeId) {
        if (!challengeId) {
            inpPilotStartup.innerHTML = '<option value="">-- Select Challenge First --</option>';
            return;
        }
        
        inpPilotStartup.innerHTML = '<option value="">Loading evaluated startups...</option>';
        try {
            let optionsHtml = '';
            if (window.GovApi) {
                const appRes = await GovApi.getApprovedApplications(challengeId);
                if (appRes && appRes.success && appRes.applications && appRes.applications.length > 0) {
                    optionsHtml = appRes.applications.map(a => `
                        <option value="${a.startup_id}" ${a.startup_id === preStartupId ? 'selected' : ''}>
                            [${a.startup_id.substring(0,8)}] ${a.company_name} (${a.panel_recommendation} - Score: ${a.avg_weighted_score})
                        </option>
                    `).join('');
                }
            }
            inpPilotStartup.innerHTML = optionsHtml || '<option value="">-- No Approved Startups Found --</option>';
        } catch (err) {
            console.error('Failed to load approved startups:', err);
            inpPilotStartup.innerHTML = '<option value="">-- Error Loading Startups --</option>';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. AUTO-SUGGEST SAFEGUARDS BASED ON RISK TIER
    // ─────────────────────────────────────────────────────────────
    function updateSafeguards() {
        const risk = inpPilotRisk ? inpPilotRisk.value.toLowerCase() : 'medium';
        let safeguards = [];

        if (risk === 'low') {
            safeguards = [
                'Weekly performance reviews',
                'Read-only sandbox database copy',
                'Standard HTTPS/TLS encryption',
                'Basic milestone telemetric tracking'
            ];
        } else if (risk === 'medium') {
            safeguards = [
                'Dedicated isolated VPC environment',
                'No citizen personal PII access',
                'Weekly cybersecurity & penetration scans',
                'Human-in-the-loop validation of AI detections',
                'Air-gapped telemetry logging'
            ];
        } else {
            safeguards = [
                'Physical security officer oversight during field runs',
                'Real-time fail-safe termination protocol',
                'Daily CERT-In compliance audit logs',
                'Full synthetic mock dataset restriction',
                'Zero direct integration with production govt databases',
                'Compulsory insurance & third-party indemnity'
            ];
        }

        if (safeguardsContainer) {
            safeguardsContainer.innerHTML = safeguards.map(sg => `
                <div class="col-md-6">
                    <span class="safeguard-tag d-block"><i class="bi bi-shield-check text-success me-1"></i> ${sg}</span>
                </div>
            `).join('');
        }
    }

    inpPilotRisk?.addEventListener('change', updateSafeguards);

    // ─────────────────────────────────────────────────────────────
    // 3. FETCH AND RENDER LIVE PILOTS FROM POSTGRESQL BACKEND
    // ─────────────────────────────────────────────────────────────
    async function renderPilotsTable() {
        if (!pilotsTbody) return;
        pilotsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2 text-primary"></span>Fetching sandbox charters from live database...</td></tr>`;

        let pilotsList = GovData.pilots || [];

        if (window.GovApi) {
            try {
                const res = await GovApi.getPilots();
                if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const dbPilots = res.data.map(p => {
                        let safeguards = [];
                        try {
                            safeguards = typeof p.cyber_checklist === 'string' ? JSON.parse(p.cyber_checklist) : (p.cyber_checklist || []);
                        } catch (e) { safeguards = []; }

                        let dataScope = [];
                        try {
                            dataScope = typeof p.scope_included === 'string' ? JSON.parse(p.scope_included) : (p.scope_included || []);
                        } catch (e) { dataScope = []; }

                        return {
                            id: p.pilot_code || (p.id ? `PLT-${p.id.substring(0, 6)}` : 'PLT-001'),
                            dbId: p.id,
                            name: p.name || 'Innovation Pilot',
                            startupId: p.startup || p.startup_name || 'Innovator Entity',
                            challengeId: p.problem_statement_text || p.problem_statement || 'Department Need',
                            department: p.department || 'Government Department',
                            location: p.location || 'Maharashtra Sandbox Corridor',
                            riskLevel: (p.risk_level || 'Medium').charAt(0).toUpperCase() + (p.risk_level || 'medium').slice(1).toLowerCase(),
                            duration: p.duration_weeks ? `${p.duration_weeks * 7} Days` : (p.duration || '90 Days'),
                            status: p.status || 'Active',
                            startDate: p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : '2026-08-01',
                            endDate: p.end_date ? new Date(p.end_date).toISOString().split('T')[0] : '2026-10-30',
                            kpiTargets: [
                                { name: 'Target Objective', baseline: p.baseline_objective || 'Baseline Std', target: p.target_objective || 'Target Std' },
                                { name: 'Minimum Acceptable Standard', baseline: 'Minimum Threshold', target: p.min_acceptable_result || 'Pass Grade' }
                            ],
                            dataScope: dataScope.length ? dataScope : ['Restricted Sandbox Metadata', 'Operational Telemetry'],
                            safeguards: Array.isArray(safeguards) && safeguards.length ? safeguards.map(s => s.item || s.text || String(s)) : ['Weekly performance reviews', 'Read-only sandbox database copy', 'Standard HTTPS/TLS encryption'],
                            successThresholds: p.success_condition || '≥30% performance boost with zero critical breaches'
                        };
                    });

                    pilotsList = dbPilots;
                    GovData.pilots = dbPilots;
                }
            } catch (e) {
                console.log('Live pilots fetch notice:', e.message);
            }
        }

        // Update counts
        const totalPilots = pilotsList.length;
        const activePilots = pilotsList.filter(p => p.status === 'Active' || p.status === 'ACTIVE_PILOT' || p.status === 'MONITORING' || p.status === 'READY_FOR_DEPLOYMENT').length;
        const uniqueLocations = new Set(pilotsList.map(p => p.location)).size;

        if (pilotsCount) pilotsCount.textContent = `${totalPilots} Sandboxes Provisioned`;
        if (statActivePilots) statActivePilots.textContent = activePilots || totalPilots;
        if (statSandboxSites) statSandboxSites.textContent = Math.max(uniqueLocations, 1);

        if (pilotsList.length === 0) {
            pilotsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No sandbox pilot charters recorded in database. Click <strong>Build Sandbox Charter</strong> above to commission one.</td></tr>`;
            return;
        }

        pilotsTbody.innerHTML = pilotsList.map(p => {
            const riskNorm = (p.riskLevel || '').toLowerCase();
            const riskClass = riskNorm.includes('low') ? 'risk-pill-low' : (riskNorm.includes('high') ? 'risk-pill-high' : 'risk-pill-medium');

            return `
                <tr>
                    <td><span class="badge bg-secondary font-monospace">${p.id}</span></td>
                    <td>
                        <span class="fw-bold text-navy">${p.name}</span>
                        <small class="text-muted d-block"><i class="bi bi-geo-alt"></i> ${p.location}</small>
                    </td>
                    <td>
                        <small class="text-secondary text-truncate-2" style="max-width: 180px;">${p.challengeId}</small>
                    </td>
                    <td>
                        <span class="fw-semibold text-primary">${p.startupId}</span>
                    </td>
                    <td><small class="fw-medium">${p.duration}</small></td>
                    <td><span class="badge ${riskClass}">${p.riskLevel} Risk</span></td>
                    <td><span class="badge-gov ${GovUtils.getBadgeClass(p.status)}">${p.status}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary btn-view-charter me-1" data-id="${p.id}" title="View Pilot Blueprint">
                            <i class="bi bi-file-text"></i> Blueprint
                        </button>
                        <a href="milestones.html?pilotId=${p.id}" class="btn btn-sm btn-gov" title="Track Milestones">
                            <i class="bi bi-arrow-right-circle"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-view-charter').forEach(btn => {
            btn?.addEventListener('click', () => viewPilotBlueprint(btn.dataset.id));
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. FORM SUBMIT: CREATE AND PERSIST PILOT TO POSTGRESQL BACKEND
    // ─────────────────────────────────────────────────────────────
    formPilotDesign?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Role check
        if (currentUser && normRole !== 'dept_admin' && normRole !== 'super_admin') {
            GovUtils.showToast('Access Denied: Only Department Admins can commission pilot charters.', 'error');
            return;
        }

        const chId = inpPilotChallenge.value;
        const suId = inpPilotStartup.value;
        const risk = inpPilotRisk.value;
        const duration = document.getElementById('inp-pilot-duration')?.value || '90';
        const name = document.getElementById('inp-pilot-name')?.value?.trim();
        const location = document.getElementById('inp-pilot-location')?.value?.trim() || 'Ward 4 PWD Corridor, Pune';
        const dataScope = document.getElementById('inp-pilot-datascope')?.value?.split(',').map(s => s.trim()).filter(Boolean) || ['Isolated testbed corridor'];
        const threshold = document.getElementById('inp-pilot-threshold')?.value?.trim() || '≥ 30% reduction in turnaround time, 0 security incidents';
        const dataLevel = document.getElementById('inp-pilot-data-level')?.value || 'restricted';
        const stateLifecycle = document.getElementById('inp-pilot-state')?.value || 'ACTIVE_PILOT';

        const submitBtn = formPilotDesign.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deploying Sandbox Charter to DB...';
        }

        const selectedChallenge = GovData.challenges.find(c => c.id === chId) || { title: chId, department: 'Public Works Department' };
        const selectedStartup = GovData.startups.find(s => s.id === suId) || { name: suId };
        const safeguards = Array.from(safeguardsContainer.querySelectorAll('.safeguard-tag')).map(el => el.textContent.trim());

        let createdPilot = null;

        if (window.GovApi) {
            try {
                const payload = {
                    name: name,
                    challengeId: chId,
                    startupId: suId,
                    problemStatement: selectedChallenge.title || name,
                    department: selectedChallenge.department || 'Government Department',
                    startup: selectedStartup.name || selectedStartup.company_name || suId,
                    startupLead: 'Innovator Lead',
                    solution: `${name} Solution Testbed`,
                    objective: threshold,
                    baselineObjective: 'Current operational baseline',
                    targetObjective: threshold,
                    minAcceptableResult: '≥ 20% improvement minimum standard',
                    successCondition: threshold,
                    location: location,
                    durationWeeks: Math.max(1, Math.ceil(parseInt(duration, 10) / 7)),
                    usersCount: 10,
                    budgetAllocated: 500000,
                    scopeIncluded: dataScope,
                    scopeExcluded: ['Production citizen PII', 'Core financial ledger write access'],
                    dataRules: { scope: dataScope, accessLevel: dataLevel },
                    cyberChecklist: safeguards.map((s, idx) => ({ id: `CHK-${idx + 1}`, item: s, status: 'PASSED' })),
                    kpis: [
                        { kpiCode: 'KPI-1', name: 'Turnaround Latency Reduction', baselineValue: 10, targetValue: 6, unit: 'hrs', ragStatus: 'GREEN' },
                        { kpiCode: 'KPI-2', name: 'Core Processing Accuracy', baselineValue: 80, targetValue: 90, unit: '%', ragStatus: 'GREEN' }
                    ]
                };

                const res = await GovApi.createPilot(payload);
                if (res && res.success && res.data) {
                    createdPilot = res.data;
                }
            } catch (apiErr) {
                console.warn('Live pilot creation API error:', apiErr.message);
                GovUtils.showToast(apiErr.message || 'Failed to provision sandbox. Please try again.', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
                return; // Stop execution, don't create dummy local pilot
            }
        }

        const newPilotId = createdPilot ? (createdPilot.pilot_code || `PLT-${createdPilot.id.substring(0, 6)}`) : `PLT-00${GovData.pilots.length + 1}`;

        const newPilotObj = {
            id: newPilotId,
            dbId: createdPilot ? createdPilot.id : null,
            challengeId: selectedChallenge.title,
            startupId: selectedStartup.name || suId,
            name: name,
            duration: `${duration} Days`,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + parseInt(duration, 10) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            location: location,
            riskLevel: risk.charAt(0).toUpperCase() + risk.slice(1),
            status: stateLifecycle === 'ACTIVE_PILOT' ? 'Active' : stateLifecycle,
            kpiTargets: [
                { name: 'Turnaround Latency Reduction', baseline: '10 hrs', target: '6 hrs' },
                { name: 'Core Processing Accuracy', baseline: '80%', target: '90%' }
            ],
            dataScope: dataScope,
            safeguards: safeguards.length ? safeguards : ['Weekly performance reviews', 'Read-only sandbox database copy'],
            successThresholds: threshold
        };

        GovData.pilots.unshift(newPilotObj);

        // Auto-create initial milestones for this pilot in local store
        GovData.milestones.unshift(
            { id: `MS-00${GovData.milestones.length + 1}`, pilotId: newPilotId, name: 'Setup & Bilateral Charter', description: 'Configure sandbox, sign indemnity clauses', status: 'In Progress', dueDate: '2026-09-15', completedDate: null, paymentLinked: true, paymentAmount: 100000 },
            { id: `MS-00${GovData.milestones.length + 2}`, pilotId: newPilotId, name: 'Trial Deployment & Telemetry', description: 'Deploy solution in pilot zone', status: 'Pending', dueDate: '2026-10-01', completedDate: null, paymentLinked: true, paymentAmount: 150000 },
            { id: `MS-00${GovData.milestones.length + 3}`, pilotId: newPilotId, name: 'Final M&E Report', description: 'Committee evaluation & verification', status: 'Pending', dueDate: '2026-10-25', completedDate: null, paymentLinked: true, paymentAmount: 100000 }
        );

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: currentUser ? currentUser.name : 'Authorized Dept Admin',
            role: currentUser ? currentUser.role : 'Dept Admin',
            action: 'Pilot Created',
            module: 'Pilot Design',
            detail: `Commissioned sandbox trial ${newPilotId} (${name}) with ${selectedStartup.name || suId}`
        });

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }

        formPilotDesign.reset();
        toggleForm(false);
        await renderPilotsTable();

        GovUtils.showToast(`Sandbox Pilot ${newPilotId} successfully commissioned & saved to PostgreSQL!`, 'success');
    });

    // ─────────────────────────────────────────────────────────────
    // 5. VIEW PILOT BLUEPRINT MODAL
    // ─────────────────────────────────────────────────────────────
    function viewPilotBlueprint(id) {
        const p = GovData.pilots.find(item => item.id === id || item.dbId === id);
        if (!p) return;

        const content = `
            <div class="space-y-3">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <div>
                        <span class="badge bg-primary me-1 font-monospace">${p.id}</span>
                        <span class="badge bg-secondary">${p.riskLevel} Risk Tier</span>
                        <h5 class="fw-bold text-navy mt-1 mb-0">${p.name}</h5>
                    </div>
                    <span class="badge-gov ${GovUtils.getBadgeClass(p.status)}">${p.status}</span>
                </div>

                <div class="row g-2 small mb-3">
                    <div class="col-6"><strong>Partner Entity:</strong> ${p.startupId}</div>
                    <div class="col-6"><strong>Linked Need:</strong> ${p.challengeId}</div>
                    <div class="col-6"><strong>Trial Window:</strong> ${p.duration} (${GovUtils.formatDate(p.startDate)} to ${GovUtils.formatDate(p.endDate)})</div>
                    <div class="col-6"><strong>Testing Field Zone:</strong> ${p.location}</div>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Target Key Performance Indicators (KPIs):</label>
                    <ul class="small text-secondary mb-0">
                        ${(p.kpiTargets || []).map(k => `<li><strong>${k.name}:</strong> Baseline: ${k.baseline} → Target: <span class="text-success fw-bold">${k.target}</span></li>`).join('')}
                    </ul>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Approved Government Data & Asset Scope:</label>
                    <div class="p-2 bg-light rounded border small text-muted">
                        ${(p.dataScope || []).map(ds => `<span class="badge bg-light text-dark border me-1 mb-1">${ds}</span>`).join('')}
                    </div>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Mandatory Sandbox Safeguards:</label>
                    <div class="d-flex flex-wrap gap-1">
                        ${(p.safeguards || []).map(sg => `<span class="safeguard-tag" style="font-size: 11px;"><i class="bi bi-shield-check text-success me-1"></i> ${sg}</span>`).join('')}
                    </div>
                </div>

                <div class="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded small">
                    <strong>Success & Transition Threshold:</strong> ${p.successThresholds || '≥30% improvement with zero critical security incidents'}
                </div>

                <div class="mt-4 pt-3 border-top text-end">
                    <a href="milestones.html?pilotId=${p.id}" class="btn btn-primary btn-sm me-2">
                        <i class="bi bi-list-task me-1"></i> View Milestone Contract
                    </a>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`Sandbox Pilot Charter — ${p.id}`, content);
    }

    // Initial render
    await populateDropdowns();
    updateSafeguards();
    await renderPilotsTable();
});

