/* =============================================
   GovCatalyst — Module 6: 4-Phase Milestone Contracting Logic
   Supports Dynamic 4-Phase Lifecycle, Escrow Tranches & State Machine
   ============================================= */

window.GovMilestones = {
    toggleMilestoneForm(show) {
        const cardMilestoneForm = document.getElementById('card-milestone-form');
        if (!cardMilestoneForm) return;
        const willShow = (typeof show === 'boolean') ? show : (cardMilestoneForm.style.display === 'none' || cardMilestoneForm.style.display === '');
        cardMilestoneForm.style.display = willShow ? 'block' : 'none';
        if (willShow) {
            cardMilestoneForm.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
                const inpName = document.getElementById('inp-ms-name');
                if (inpName) inpName.focus();
            }, 150);
        }
    },

    openAgreementModal() {
        const selPilot = document.getElementById('sel-pilot');
        const pId = selPilot ? selPilot.value : (GovData.pilots[0] ? GovData.pilots[0].id : 'PLT-001');
        const p = (GovData.pilots && GovData.pilots.find(item => item.id === pId || item.dbId === pId)) || GovData.pilots[0];
        if (!p) return;
        const su = (GovData.startups && GovData.startups.find(s => s.id === p.startupId)) || { name: p.startupId || 'Innovator Entity', founders: 'Startup Founders' };
        const pMilestones = (GovData.milestones && GovData.milestones.filter(m => m.pilotId === p.id || m.pilotId === pId)) || [];

        const content = `
            <div class="agreement-print-container border p-4 bg-white">
                <div class="text-center pb-3 border-bottom mb-4">
                    <div class="fw-bold" style="font-size: 16px;">GOVERNMENT OF MAHARASHTRA</div>
                    <div class="text-muted small">Maharashtra State Innovation Society &bull; GFR Rule 194 Innovation Procurement Framework</div>
                    <h5 class="fw-bold text-navy mt-2">BILATERAL INNOVATION PILOT & 4-PHASE SANDBOX AGREEMENT</h5>
                    <small class="font-monospace text-muted">Contract Ref: GC-AGR-2026-${p.id}</small>
                </div>

                <p class="small">This Agreement is executed between the <strong>Department of ${p.challengeId || 'Innovation & Technology'}</strong>, Government of Maharashtra, and <strong>${su.name}</strong> (hereinafter "Innovator").</p>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">1. Scope of Trial Sandbox</h6>
                <p class="small">The Innovator is authorized to deploy the <strong>${p.name}</strong> in the designated test zone at <strong>${p.location}</strong> for a duration of <strong>${p.duration}</strong> commencing on ${GovUtils.formatDate(p.startDate)}.</p>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">2. Core Legal Covenants</h6>
                <ol class="small text-secondary ps-3">
                    ${(GovData.agreementClauses || []).map(cl => `<li class="mb-2"><strong>${cl.category}:</strong> ${cl.text}</li>`).join('')}
                </ol>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">3. 4-Phase Milestone Schedule & Escrow Payouts</h6>
                <table class="table table-sm table-bordered small mt-2">
                    <thead class="table-light">
                        <tr><th>Phase</th><th>Milestone ID</th><th>Deliverable Description</th><th>Due Date</th><th>Escrow Tranche</th></tr>
                    </thead>
                    <tbody>
                        ${pMilestones.map(m => `
                            <tr>
                                <td><span class="badge phase-pill-${m.phase || 1}">Phase ${m.phase || 1}</span></td>
                                <td>${m.id}</td>
                                <td><strong>${m.name}</strong><br><small class="text-muted">${m.description}</small></td>
                                <td>${GovUtils.formatDate(m.dueDate)}</td>
                                <td class="fw-bold text-navy">${GovUtils.formatCurrency(m.paymentAmount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="row pt-4 mt-4 border-top text-center small">
                    <div class="col-6">
                        <div class="mb-4">_______________________________</div>
                        <strong>Authorized Department Officer</strong><br>
                        Government of Maharashtra
                    </div>
                    <div class="col-6">
                        <div class="mb-4">_______________________________</div>
                        <strong>Authorized Signatory</strong><br>
                        ${su.name}
                    </div>
                </div>

                <div class="text-end mt-4 pt-3 border-top no-print">
                    <button class="btn btn-outline-dark btn-sm me-2" onclick="window.print()"><i class="bi bi-printer me-1"></i> Print / Save PDF</button>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`Bilateral Pilot Agreement — ${p.name}`, content);
    },

    autoSet4Phases() {
        const btn = document.getElementById('btn-auto-4phases');
        if (btn) btn.click();
    }
};


document.addEventListener('DOMContentLoaded', async () => {
    const selPilot = document.getElementById('sel-pilot');
    const partnerName = document.getElementById('contract-partner-name');
    const pilotStatusBadge = document.getElementById('pilot-status-badge');
    const visualPipeline = document.getElementById('visual-pipeline');
    const cardsContainer = document.getElementById('milestones-cards-container');
    const clausesAccordion = document.getElementById('clauses-accordion');
    const btnViewAgreement = document.getElementById('btn-view-agreement');
    const btnAuto4Phases = document.getElementById('btn-auto-4phases');

    const cardMilestoneForm = document.getElementById('card-milestone-form');
    const btnToggleMilestoneForm = document.getElementById('btn-toggle-milestone-form');
    const btnCloseMilestoneForm = document.getElementById('btn-close-milestone-form');
    const btnCancelMilestoneForm = document.getElementById('btn-cancel-milestone-form');
    const formAddMilestone = document.getElementById('form-add-milestone');

    const statTotalMilestones = document.getElementById('stat-total-milestones');
    const statCompletedMilestones = document.getElementById('stat-completed-milestones');
    const statActivePhase = document.getElementById('stat-active-phase');
    const statEscrowAmount = document.getElementById('stat-escrow-amount');

    // Parse URL param if directed from Pilot Design
    const urlParams = new URLSearchParams(window.location.search);
    const prePilotId = urlParams.get('pilotId');

    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    const normRole = currentUser && currentUser.role ? currentUser.role.toLowerCase().replace(/[\s-]/g, '_') : '';

    // Standard 4 Phases Definition
    const PHASES = [
        { id: 1, name: 'Setup & Bilateral Agreement', code: 'PHASE-1', desc: 'Indemnity, legal covenants & baseline scoping' },
        { id: 2, name: 'Deployment & Telemetry Integration', code: 'PHASE-2', desc: 'Sensor install, VPC testbed isolation & telemetry' },
        { id: 3, name: 'Active Sandbox Testing & Execution', code: 'PHASE-3', desc: 'Field trials, live operational data & mid-term review' },
        { id: 4, name: 'Final Evaluation, Audit & Transition', code: 'PHASE-4', desc: 'Committee report, validator sign-off & GeM scale' }
    ];

    // Toggle Form
    function toggleMilestoneForm(show) {
        if (!cardMilestoneForm) return;
        const willShow = (typeof show === 'boolean') ? show : (cardMilestoneForm.style.display === 'none' || cardMilestoneForm.style.display === '');
        cardMilestoneForm.style.display = willShow ? 'block' : 'none';
        if (willShow) {
            cardMilestoneForm.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
                const inpName = document.getElementById('inp-ms-name');
                if (inpName) inpName.focus();
            }, 150);
        }
    }

    btnToggleMilestoneForm?.addEventListener('click', () => toggleMilestoneForm());
    document.getElementById('btn-new-contract')?.addEventListener('click', () => toggleMilestoneForm(true));
    btnCloseMilestoneForm?.addEventListener('click', () => toggleMilestoneForm(false));
    btnCancelMilestoneForm?.addEventListener('click', () => toggleMilestoneForm(false));

    // ─────────────────────────────────────────────────────────────
    // 1. POPULATE PILOTS FROM BACKEND OR LOCAL STORE
    // ─────────────────────────────────────────────────────────────
    async function populatePilots() {
        let pilots = GovData.pilots || [];

        if (window.GovApi) {
            // If not logged in, don't bother calling the API
            const token = GovApi.getToken();
            if (!token) {
                if (selPilot) selPilot.innerHTML = '<option disabled selected>⚠ Not signed in — please log in to load pilots</option>';
                GovUtils.showToast('Please sign in to view your pilot sandbox contracts.', 'warning');
                return;
            }

            // Show a loading placeholder in the dropdown
            if (selPilot) selPilot.innerHTML = '<option disabled selected>Loading pilots from database…</option>';
            try {
                const res = await GovApi.getPilots();
                if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const livePilots = res.data.map(p => ({
                        id: p.pilot_code || (p.id ? `PLT-${p.id.substring(0, 6)}` : 'PLT-001'),
                        dbId: p.id,
                        name: p.name || 'Sandbox Pilot',
                        startupId: p.startup || 'Innovator Entity',
                        challengeId: p.problem_statement_text || 'Innovation Need',
                        location: p.location || 'Maharashtra',
                        status: p.status || 'Active',
                        duration: p.duration_weeks ? `${p.duration_weeks * 7} Days` : '90 Days',
                        startDate: p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : '2026-08-01',
                        endDate: p.end_date ? new Date(p.end_date).toISOString().split('T')[0] : '2026-10-30'
                    }));
                    GovData.pilots = livePilots;
                    pilots = livePilots;
                } else if (res && res.success && Array.isArray(res.data) && res.data.length === 0) {
                    // Authenticated but no pilots in DB yet
                    if (selPilot) selPilot.innerHTML = '<option disabled selected>No pilot sandbox contracts found in database</option>';
                    if (cardsContainer) cardsContainer.innerHTML = `
                        <div class="col-12 text-center py-5">
                            <i class="bi bi-inbox fs-1 text-secondary d-block mb-3"></i>
                            <h5 class="fw-bold text-navy">No Pilot Sandboxes Found</h5>
                            <p class="text-muted small">No pilot contracts exist in the database yet. Create one via the <a href="pilot-design.html">Pilot Design</a> module.</p>
                        </div>`;
                    return;
                }
            } catch (e) {
                console.warn('Pilots fetch error:', e.message);
                const isNetworkErr = e.message.includes('fetch') || e.message.includes('network') || e.message.includes('ECONNREFUSED') || e.message.includes('Failed');
                const errMsg = isNetworkErr
                    ? 'Cannot reach server — check your connection or that the server is running.'
                    : (e.message || 'Could not fetch pilots from backend.');
                if (selPilot) selPilot.innerHTML = `<option disabled selected>⚠ ${errMsg}</option>`;
                GovUtils.showToast(errMsg, 'error');
                return;
            }
        }

        if (selPilot) {
            selPilot.innerHTML = pilots.length > 0
                ? pilots.map(p => `
                <option value="${p.dbId || p.id}" ${(p.dbId === prePilotId || p.id === prePilotId) ? 'selected' : ''}>
                    [${p.id}] ${p.name} (${p.status})
                </option>
            `).join('')
                : '<option disabled selected>No pilots available</option>';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. AUTO-PROVISION STANDARD 4-PHASE MILESTONES FOR A PILOT
    // ─────────────────────────────────────────────────────────────
    async function autoProvision4Phases(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId || item.dbId === pilotId);
        if (!p) return;

        const btnAuto = document.getElementById('btn-auto-4phases');
        const origText = btnAuto ? btnAuto.innerHTML : '';
        if (btnAuto) btnAuto.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Provisioning...';

        try {
            if (window.GovApi) {
                const dbId = p.dbId || pilotId;
                const res = await GovApi.autoGenerateMilestones(dbId);
                if (res && res.success) {
                    GovUtils.showToast(`Standard 4-Phase milestone schedule configured for ${pilotId}!`, 'success');
                } else {
                    throw new Error(res.message || 'Auto-generation failed');
                }
            } else {
                GovUtils.showToast('API not available. Cannot auto-provision in offline mode.', 'error');
            }
        } catch (e) {
            console.error('Milestone auto-provision error:', e);
            GovUtils.showToast(e.message || 'Failed to provision milestones', 'error');
        } finally {
            if (btnAuto) btnAuto.innerHTML = origText;
            await renderMilestoneCards(pilotId);
        }
    }

    btnAuto4Phases?.addEventListener('click', () => {
        const pId = selPilot.value;
        if (!pId) return;
        autoProvision4Phases(pId);
    });

    // ─────────────────────────────────────────────────────────────
    // 3. RENDER 4-PHASE PROGRESS STEPPER & CARDS
    // ─────────────────────────────────────────────────────────────
    function renderPipeline(pilotMilestones) {
        if (!visualPipeline) return;

        // Calculate completion status per Phase 1-4
        const phaseProgress = [1, 2, 3, 4].map(phId => {
            const phMilestones = pilotMilestones.filter(m => (m.phase || 1) === phId);
            const total = phMilestones.length;
            const completed = phMilestones.filter(m => m.status === 'Completed' || m.status === 'Verified').length;
            const inProgress = phMilestones.some(m => m.status === 'In Progress' || m.status === 'Under Review');
            return {
                id: phId,
                total,
                completed,
                isCompleted: total > 0 && completed === total,
                isActive: inProgress || (total > 0 && completed < total && !phMilestones.every(m => m.status === 'Pending'))
            };
        });

        // Determine current active phase for summary card
        const activePh = phaseProgress.find(p => p.isActive) || phaseProgress.find(p => !p.isCompleted) || phaseProgress[0];
        if (statActivePhase) statActivePhase.textContent = `Phase ${activePh.id}`;

        visualPipeline.innerHTML = PHASES.map((ph, idx) => {
            const prog = phaseProgress[idx];
            let itemClass = '';
            let circleContent = `${ph.id}`;

            if (prog.isCompleted) {
                itemClass = 'completed';
                circleContent = '<i class="bi bi-check-lg"></i>';
            } else if (prog.isActive) {
                itemClass = 'active';
                circleContent = '<i class="bi bi-hourglass-split"></i>';
            }

            const countText = prog.total > 0 ? `${prog.completed}/${prog.total} Done` : '0 Milestones';

            return `
                <div class="phase-step-item ${itemClass}">
                    <div class="phase-step-circle">${circleContent}</div>
                    <div class="phase-step-title">Phase ${ph.id}</div>
                    <div class="phase-step-desc text-truncate" title="${ph.name}">${ph.name}</div>
                    <small class="badge bg-light text-dark border mt-1" style="font-size: 10px;">${countText}</small>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────────
    // 4. RENDER MILESTONE CARDS GROUPED BY 4 PHASES
    // ─────────────────────────────────────────────────────────────
    async function renderMilestoneCards(pilotDbId) {
        const p = GovData.pilots.find(item => item.dbId === pilotDbId || item.id === pilotDbId);
        if (!p) return;
        const dbId = p.dbId || pilotDbId;

        if (partnerName) partnerName.textContent = `${p.startup || p.startupId || 'Innovator'} · ${p.location || 'Maharashtra Sandbox'}`;
        if (pilotStatusBadge) pilotStatusBadge.textContent = p.status || 'Active Sandbox';

        // Show loading skeleton while fetching
        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div class="col-12">
                    <div class="d-flex align-items-center gap-2 py-4 text-muted justify-content-center">
                        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
                        <span class="small fw-semibold">Fetching milestone data from database…</span>
                    </div>
                </div>`;
        }

        // Fetch KPIs, evidences and milestones from backend in parallel
        let backendKpis = [], backendEvidences = [], pMilestones = [];
        try {
            if (window.GovApi) {
                const [kpiRes, evRes, msRes] = await Promise.all([
                    GovApi.getPilotKpis(dbId).catch(() => null),
                    GovApi.getPilotEvidences(dbId).catch(() => null),
                    GovApi.getPilotMilestones(dbId).catch(() => null)
                ]);
                if (kpiRes && kpiRes.success && Array.isArray(kpiRes.data)) backendKpis = kpiRes.data;
                if (evRes && evRes.success && Array.isArray(evRes.data)) backendEvidences = evRes.data;
                if (msRes && msRes.success && Array.isArray(msRes.data)) {
                    pMilestones = msRes.data.map(m => ({
                        id: m.milestone_code,
                        dbId: m.id,
                        pilotId: pilotDbId,
                        phase: m.phase,
                        name: m.name,
                        description: m.description,
                        status: m.status,
                        dueDate: m.due_date,
                        completedDate: m.completed_date,
                        paymentLinked: m.payment_linked,
                        paymentAmount: parseFloat(m.payment_amount) || 0,
                        evidenceType: 'System Record'
                    }));
                }
            }
        } catch (e) {
            console.warn('Backend data fetch fallback:', e.message);
            // Fall back to local store and show a non-blocking warning
            pMilestones = GovData.milestones.filter(m => m.pilotId === p.id);
            if (cardsContainer) {
                const warn = document.createElement('div');
                warn.className = 'col-12';
                warn.innerHTML = `<div class="alert alert-warning alert-dismissible small py-2 mb-2" role="alert">
                    <i class="bi bi-wifi-off me-1"></i> Could not reach backend — showing cached data.
                    <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert"></button>
                </div>`;
                cardsContainer.prepend(warn);
            }
        }

        // Cache for agreement modal and other uses
        p._backendKpis = backendKpis;
        p._backendEvidences = backendEvidences;
        p._backendMilestones = pMilestones;
        GovData.milestones = GovData.milestones.filter(m => m.pilotId !== p.id && m.pilotId !== pilotDbId);
        GovData.milestones.push(...pMilestones.map(m => ({ ...m, pilotId: p.id })));

        // Update summary stats
        const total = pMilestones.length;
        const completed = pMilestones.filter(m => m.status === 'Completed' || m.status === 'Verified').length;
        const totalEscrow = pMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);

        if (statTotalMilestones) statTotalMilestones.textContent = total;
        if (statCompletedMilestones) statCompletedMilestones.textContent = completed;
        if (statEscrowAmount) statEscrowAmount.textContent = GovUtils.formatCurrency(totalEscrow);

        renderPipeline(pMilestones);

        if (!pMilestones.length) {
            cardsContainer.innerHTML = `
                <div class="col-12 text-center py-5 bg-light rounded border">
                    <i class="bi bi-diagram-3 fs-1 text-secondary mb-3 d-block"></i>
                    <h5 class="fw-bold text-navy">No Milestones Defined for ${p.name}</h5>
                    <p class="text-muted small mb-3">Set up the 4-phase legal contracting lifecycle for this sandbox pilot.</p>
                    <button class="btn btn-gold btn-sm me-2" onclick="document.getElementById('btn-auto-4phases').click()">
                        <i class="bi bi-lightning-charge-fill me-1"></i> Auto-Set 4 Phases (Recommended)
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="document.getElementById('btn-toggle-milestone-form').click()">
                        <i class="bi bi-plus-circle me-1"></i> Add Custom Milestone
                    </button>
                </div>
            `;
            return;
        }

        // Group milestones into the 4 Phases
        let html = '';
        PHASES.forEach(ph => {
            const phMilestones = pMilestones.filter(m => (m.phase || 1) === ph.id);
            const phEscrow = phMilestones.reduce((s, m) => s + (m.paymentAmount || 0), 0);
            const phCompleted = phMilestones.filter(m => m.status === 'Completed').length;

            html += `
                <div class="phase-container mb-4">
                    <div class="phase-section-header">
                        <div>
                            <span class="badge phase-pill-${ph.id} fw-bold me-2 font-monospace">PHASE ${ph.id}</span>
                            <strong class="text-navy">${ph.name}</strong>
                            <small class="text-muted d-block ms-1 mt-1" style="font-size: 11px;">${ph.desc}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-secondary font-monospace">${phCompleted}/${phMilestones.length} Done</span>
                            <span class="badge bg-light text-dark border ms-1">${GovUtils.formatCurrency(phEscrow)} Escrow</span>
                        </div>
                    </div>

                    <div class="row g-3">
                        ${phMilestones.length === 0 ? `
                            <div class="col-12">
                                <div class="p-3 bg-light rounded text-muted small text-center border-dashed">
                                    No milestones in Phase ${ph.id}. <a href="javascript:void(0)" onclick="openAddModalForPhase(${ph.id})" class="text-primary fw-semibold">+ Add Phase ${ph.id} Milestone</a>
                                </div>
                            </div>
                        ` : phMilestones.map(m => {
                            const isDone = m.status === 'Completed' || m.status === 'Verified';
                            const stateClass = isDone ? 'state-completed' : (m.status === 'In Progress' ? 'state-inprogress' : (m.status === 'Under Review' ? 'state-inprogress' : 'state-pending'));
                            const badgeClass = isDone ? 'state-badge-completed' : (m.status === 'In Progress' ? 'state-badge-inprogress' : (m.status === 'Under Review' ? 'bg-info text-dark' : 'state-badge-pending'));

                            let nextActionBtn = '';
                            const isStartup = normRole === 'startup';
                            const isGov = normRole === 'dept_admin' || normRole === 'super_admin' || normRole === 'validator';

                            if (m.status === 'Pending') {
                                if (isStartup) {
                                    nextActionBtn = `<button class="btn btn-sm btn-outline-primary btn-start-exec" data-dbid="${m.dbId}" data-id="${m.id}"><i class="bi bi-play-circle me-1"></i> Start Execution</button>`;
                                } else {
                                    nextActionBtn = `<span class="text-muted small"><i class="bi bi-hourglass me-1"></i> Awaiting Startup Action</span>`;
                                }
                            } else if (m.status === 'In Progress') {
                                if (isStartup) {
                                    const escapedName = (m.name || '').replace(/"/g, '&quot;');
                                    const escapedEv = (m.evidenceType || 'System Audit Logs / Telemetry').replace(/"/g, '&quot;');
                                    nextActionBtn = `<button class="btn btn-sm btn-outline-warning btn-submit-deliv" data-dbid="${m.dbId}" data-id="${m.id}" data-phase="${m.phase || ph.id}" data-name="${escapedName}" data-evidence="${escapedEv}" data-amount="${m.paymentAmount}"><i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable</button>`;
                                } else {
                                    nextActionBtn = `<span class="text-warning small"><i class="bi bi-gear-wide-connected me-1"></i> Under Active Development</span>`;
                                }
                            } else if (m.status === 'Under Review') {
                                if (isGov) {
                                    nextActionBtn = `<button class="btn btn-sm btn-success btn-advance-verify" data-dbid="${m.dbId}" data-id="${m.id}" data-amount="${m.paymentAmount}" data-next="Verified"><i class="bi bi-shield-fill-check me-1"></i> Verify &amp; Disburse</button>`;
                                } else {
                                    nextActionBtn = `<span class="text-info small"><i class="bi bi-clock-history me-1"></i> Under Review by Government</span>`;
                                }
                            } else {
                                nextActionBtn = `<span class="text-success small fw-bold"><i class="bi bi-patch-check-fill me-1"></i> Verified &amp; Paid</span>`;
                            }

                            // Lookup matching evidence proof details
                            const matchingEv = backendEvidences.find(ev => ev.related_milestone === m.id || ev.related_milestone === m.milestone_code);
                            let evidenceBlock = '';
                            if (matchingEv) {
                                const isFile = matchingEv.file_url && (matchingEv.file_url.includes('/uploads/') || /\.(pdf|zip|json|png|jpg|jpeg|gif|csv|txt)$/i.test(matchingEv.file_url));
                                const icon = isFile ? 'bi-file-earmark-check-fill text-success' : 'bi-link-45deg text-primary';
                                evidenceBlock = `
                                    <div class="mt-2 p-2 bg-white rounded border d-flex align-items-center justify-content-between" style="font-size: 11px;">
                                        <div class="small text-truncate me-2" style="max-width: 70%;">
                                            <i class="bi ${icon} me-1"></i>
                                            <strong>Submitted:</strong> <span class="text-secondary" title="${matchingEv.name}">${matchingEv.name}</span>
                                        </div>
                                        <a href="${matchingEv.file_url}" target="_blank" class="btn btn-xs btn-outline-primary py-0 px-2 fw-semibold" style="font-size: 10px; height: 18px; line-height: 16px;">
                                            <i class="bi bi-box-arrow-up-right me-1"></i>View Proof
                                        </a>
                                    </div>
                                `;
                            }

                            return `
                                <div class="col-md-6">
                                    <div class="gov-card milestone-card ${stateClass} h-100 mb-0">
                                        <div class="gov-card-body">
                                            <div class="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <span class="badge bg-secondary font-monospace" style="font-size: 11px;">${m.id}</span>
                                                    <span class="badge ${badgeClass} ms-1" style="font-size: 11px;">${m.status}</span>
                                                    <span class="badge bg-light text-dark border ms-1" style="font-size: 10px;">Phase ${m.phase || ph.id}</span>
                                                </div>
                                                <strong class="text-navy">${GovUtils.formatCurrency(m.paymentAmount)}</strong>
                                            </div>

                                            <h6 class="fw-bold text-navy mb-1">${m.name}</h6>
                                            <p class="small text-secondary mb-2" style="font-size: 12px;">${m.description}</p>

                                            <div class="p-2 bg-light rounded small mb-2 text-muted" style="font-size: 11px;">
                                                <i class="bi bi-file-earmark-check text-primary me-1"></i>
                                                <strong>Evidence Required:</strong> ${m.evidenceType || 'System Audit Logs / Telemetry'}
                                            </div>

                                            ${evidenceBlock}

                                            <div class="row g-1 small border-top pt-2 text-muted mb-2" style="font-size: 11px;">
                                                <div class="col-6"><strong>Due:</strong> ${GovUtils.formatDate(m.dueDate)}</div>
                                                <div class="col-6"><strong>Completed:</strong> ${m.completedDate ? GovUtils.formatDate(m.completedDate) : '—'}</div>
                                            </div>

                                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                                <small class="text-muted">Escrow: <strong>${m.paymentLinked ? 'Linked' : 'None'}</strong></small>
                                                <div>${nextActionBtn}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        cardsContainer.innerHTML = html;

        // 1. Bind "Start Execution" buttons (Pending → In Progress)
        document.querySelectorAll('.btn-start-exec').forEach(btn => {
            btn?.addEventListener('click', () => {
                const mId = btn.dataset.id;
                const dbId = btn.dataset.dbid;
                startMilestoneExecution(mId, dbId, btn);
            });
        });

        // 2. Bind "Submit Deliverable" buttons (In Progress → Deliverable Submission Modal → Under Review)
        document.querySelectorAll('.btn-submit-deliv').forEach(btn => {
            btn?.addEventListener('click', () => {
                const mId = btn.dataset.id;
                const dbId = btn.dataset.dbid;
                const phase = btn.dataset.phase || '1';
                const name = btn.dataset.name || 'Deliverable';
                const evidence = btn.dataset.evidence || '';
                const amount = parseFloat(btn.dataset.amount) || 0;
                openSubmitDeliverableModal(mId, dbId, phase, name, evidence, amount);
            });
        });

        // 3. Bind "Verify & Disburse" buttons — requires confirmation before irreversible escrow payout
        document.querySelectorAll('.btn-advance-verify').forEach(btn => {
            btn?.addEventListener('click', () => {
                const mId = btn.dataset.id;
                const dbId = btn.dataset.dbid;
                const amount = parseFloat(btn.dataset.amount) || 0;
                const formatted = GovUtils.formatCurrency(amount);

                // Confirmation modal
                const overlayId = 'escrow-confirm-overlay';
                let overlay = document.getElementById(overlayId);
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = overlayId;
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
                    document.body.appendChild(overlay);
                }
                overlay.innerHTML = `
                    <div class="bg-white rounded-3 shadow-lg p-4" style="max-width:420px;width:90%;">
                        <div class="text-center mb-3">
                            <i class="bi bi-shield-lock-fill fs-1 text-warning"></i>
                        </div>
                        <h5 class="fw-bold text-navy text-center mb-1">Confirm Escrow Disbursal</h5>
                        <p class="text-muted small text-center mb-3">You are about to verify this milestone deliverable and release the escrow tranche. This action <strong>cannot be undone</strong>.</p>
                        <div class="p-3 bg-light rounded border mb-3 text-center">
                            <div class="text-muted small">Escrow Tranche Amount</div>
                            <div class="fs-4 fw-bold text-success">${formatted}</div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-secondary flex-fill" id="escrow-cancel-btn"><i class="bi bi-x-circle me-1"></i>Cancel</button>
                            <button class="btn btn-success flex-fill" id="escrow-confirm-btn"><i class="bi bi-patch-check-fill me-1"></i>Confirm & Disburse</button>
                        </div>
                    </div>
                `;
                overlay.style.display = 'flex';

                document.getElementById('escrow-cancel-btn').onclick = () => { overlay.style.display = 'none'; };
                document.getElementById('escrow-confirm-btn').onclick = () => {
                    overlay.style.display = 'none';
                    advanceMilestoneState(mId, dbId, 'Verified');
                };
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. START MILESTONE EXECUTION
    // ─────────────────────────────────────────────────────────────
    async function startMilestoneExecution(mId, dbId, btn) {
        const pId = selPilot.value;
        const p = GovData.pilots.find(item => item.dbId === pId || item.id === pId);
        const backendPilotId = p?.dbId || pId;

        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Starting...';
        }

        try {
            if (window.GovApi && dbId) {
                await GovApi.updateMilestoneStatus(backendPilotId, dbId, 'In Progress');
            }

            GovData.auditTrail.unshift({
                id: GovData.auditTrail.length + 1,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                user: (currentUser && currentUser.name) || 'Authorized Officer',
                role: (currentUser && currentUser.role) || 'Startup',
                action: 'Milestone Execution Started',
                module: 'Milestones',
                detail: `Started active execution for milestone ${mId} (Status: In Progress)`
            });

            GovUtils.showToast(`Milestone ${mId} is now In Progress! Sandbox trial testing is active.`, 'success');
            await renderMilestoneCards(pId);
        } catch (e) {
            console.error('Milestone start error:', e);
            GovUtils.showToast('Failed to start execution: ' + (e.message || 'Server error'), 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. DELIVERABLE SUBMISSION MODAL
    // ─────────────────────────────────────────────────────────────
    function openSubmitDeliverableModal(mId, dbId, phase, milestoneName, evidenceType, dueAmount) {
        const pId = selPilot.value;
        const p = GovData.pilots.find(item => item.dbId === pId || item.id === pId);
        
        const content = `
            <div class="p-1">
                <div class="alert alert-primary d-flex align-items-center mb-3">
                    <i class="bi bi-info-circle-fill fs-4 me-3 text-primary"></i>
                    <div>
                        <strong>Phase ${phase}: ${milestoneName}</strong>
                        <div class="small text-muted">Target Evidence: <strong>${evidenceType || 'System Audit Logs / Telemetry'}</strong></div>
                    </div>
                </div>

                <form id="form-submit-deliverable" onsubmit="return false;">
                    <div class="mb-3">
                        <label class="form-label fw-bold small text-navy">Deliverable Title / Summary <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="inp-deliv-title" placeholder="e.g. Phase ${phase} Execution Artifacts & Accuracy Test Log" value="${milestoneName} — Completion Artifact" required>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-md-6">
                            <label class="form-label fw-bold small text-navy">Evidence Category</label>
                            <select class="form-select" id="inp-deliv-type">
                                <option value="Telemetry Dataset">Telemetry Dataset & Metrics</option>
                                <option value="Audit Report">Independent Audit / CERT-In Report</option>
                                <option value="Code Repository">Code Repository / Release Artifact</option>
                                <option value="Deployment Certificate">Deployment Sign-off Certificate</option>
                                <option value="Field Trial Log">Field Trial Run Log</option>
                                <option value="Security Verification">Security Compliance Report</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold small text-navy">Evidence Document / Repository Link</label>
                            <input type="url" class="form-control font-monospace small" id="inp-deliv-url" placeholder="https://..." value="https://sandbox.maharashtra.gov.in/evidence/${mId.toLowerCase()}">
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label fw-bold small text-navy">Upload Proof Document / File</label>
                        <input type="file" class="form-control" id="inp-deliv-file" accept=".pdf,.zip,.json,.png,.csv,.txt,.docx,.xlsx,.jpg">
                        <div class="form-text text-muted" style="font-size: 11px;">Supported formats: PDF, ZIP, JSON, CSV, Excel, Word, Images. Max 10MB.</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label fw-bold small text-navy">Execution Notes & Verification Summary</label>
                        <textarea class="form-control" id="inp-deliv-notes" rows="3" placeholder="Describe the deliverables completed, telemetry benchmarks achieved, and how requirements were met..."></textarea>
                    </div>

                    ${dueAmount > 0 ? `
                    <div class="p-2 mb-3 bg-light rounded border d-flex justify-content-between align-items-center">
                        <span class="small text-muted"><i class="bi bi-cash-stack text-success me-1"></i> Associated Escrow Tranche:</span>
                        <strong class="text-navy">${GovUtils.formatCurrency(dueAmount)}</strong>
                    </div>` : ''}

                    <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-gold btn-sm" id="btn-confirm-submit-deliverable">
                            <i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable for Review
                        </button>
                    </div>
                </form>
            </div>
        `;

        GovUtils.openModal(`Submit Deliverable — ${mId}`, content);

        const form = document.getElementById('form-submit-deliverable');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-confirm-submit-deliverable');
            const title = document.getElementById('inp-deliv-title')?.value.trim();
            const docType = document.getElementById('inp-deliv-type')?.value;
            const urlInput = document.getElementById('inp-deliv-url')?.value.trim();
            const notes = document.getElementById('inp-deliv-notes')?.value.trim();
            const fileInput = document.getElementById('inp-deliv-file');

            let finalUrl = urlInput || null;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Preparing submission...';
            }

            const backendPilotId = p?.dbId || pId;
            try {
                // If a file is selected, upload it first to the backend
                if (fileInput && fileInput.files && fileInput.files[0]) {
                    if (submitBtn) {
                        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Uploading proof file...';
                    }
                    const uploadRes = await GovApi.uploadFile(fileInput.files[0]);
                    if (uploadRes && uploadRes.success && uploadRes.data && uploadRes.data.fileUrl) {
                        const baseUrl = GovApi.getBaseUrl();
                        finalUrl = baseUrl ? `${baseUrl}${uploadRes.data.fileUrl}` : window.location.origin + uploadRes.data.fileUrl;
                    } else {
                        throw new Error(uploadRes.message || 'File upload failed');
                    }
                }

                if (window.GovApi) {
                    // 1. Record evidence in gov_pilot_evidences
                    await GovApi.addPilotEvidence(backendPilotId, {
                        evidenceCode: `EV-${mId}-${Date.now().toString().slice(-4)}`,
                        name: title || `${mId} Deliverable Proof`,
                        documentType: docType || 'Deliverable',
                        fileUrl: finalUrl,
                        relatedMilestone: mId,
                        notes: notes || null,
                        uploadedBy: (currentUser && currentUser.name) || 'Startup Innovator'
                    }).catch(err => console.warn('Evidence record notice:', err.message));

                    // 2. Advance milestone state to 'Under Review'
                    await GovApi.updateMilestoneStatus(backendPilotId, dbId, 'Under Review');
                }

                GovData.auditTrail.unshift({
                    id: GovData.auditTrail.length + 1,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    user: (currentUser && currentUser.name) || 'Startup Innovator',
                    role: (currentUser && currentUser.role) || 'Startup',
                    action: 'Deliverable Submitted',
                    module: 'Milestones',
                    detail: `Submitted deliverable for ${mId} (${title}): Transitioned to Under Review`
                });

                GovUtils.closeModal();
                GovUtils.showToast(`Deliverable for ${mId} submitted! Placed Under Review for Department Admin / Validator sign-off.`, 'success');
                await renderMilestoneCards(pId);
            } catch (err) {
                console.error('Deliverable submit error:', err);
                GovUtils.showToast('Failed to submit deliverable: ' + (err.message || 'Server error'), 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable for Review';
                }
            }
        });
    }

    window.openAddModalForPhase = function(phId) {
        const phaseSelect = document.getElementById('inp-ms-phase');
        if (phaseSelect) phaseSelect.value = phId;
        toggleMilestoneForm(true);
    };

    // ─────────────────────────────────────────────────────────────
    // 7. GENERIC STATE MACHINE ADVANCE LOGIC (e.g. Verify & Disburse)
    // ─────────────────────────────────────────────────────────────
    async function advanceMilestoneState(mId, dbId, nextState) {
        const pId = selPilot.value;
        const p = GovData.pilots.find(item => item.dbId === pId || item.id === pId);
        const backendPilotId = p?.dbId || pId;

        try {
            if (window.GovApi && dbId) {
                await GovApi.updateMilestoneStatus(backendPilotId, dbId, nextState);
            }
        } catch (e) {
            console.error('Milestone update error:', e);
            GovUtils.showToast('Failed to update milestone — ' + (e.message || 'server error'), 'error');
            return; // ← abort: don't show success or re-render stale state
        }

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: currentUser ? currentUser.name : 'Authorized Officer',
            role: currentUser ? currentUser.role : 'Dept Admin',
            action: 'Milestone Advanced',
            module: 'Milestones',
            detail: `Advanced milestone ${mId} to state: ${nextState}`
        });

        await renderMilestoneCards(pId);
        const msg = nextState === 'Verified'
            ? `✅ Milestone ${mId} verified and escrow tranche disbursed!`
            : `Milestone ${mId} transitioned to "${nextState}"!`;
        GovUtils.showToast(msg, 'success');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. ADD NEW MILESTONE FORM SUBMIT
    // ─────────────────────────────────────────────────────────────

    // Update the pilot context label whenever the dropdown changes
    function updateMilestoneFormPilotLabel() {
        const pId = selPilot?.value;
        const p = pId && GovData.pilots.find(item => item.dbId === pId || item.id === pId);
        const label = document.getElementById('ms-form-pilot-label');
        if (label) label.textContent = p ? `Adding milestone to: [${p.id}] ${p.name}` : 'Select a pilot above first';
    }
    selPilot?.addEventListener('change', updateMilestoneFormPilotLabel);
    // Trigger on load after pilots populate
    setTimeout(updateMilestoneFormPilotLabel, 600);

    formAddMilestone?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pId = selPilot.value;
        if (!pId) {
            GovUtils.showToast('Please select a target pilot contract first.', 'warning');
            return;
        }

        const phase = parseInt(document.getElementById('inp-ms-phase').value, 10) || 1;
        const name = document.getElementById('inp-ms-name').value.trim();
        const desc = document.getElementById('inp-ms-desc').value.trim();
        const dueDate = document.getElementById('inp-ms-due').value;
        const amount = parseInt(document.getElementById('inp-ms-amount').value, 10) || 0;
        const evidence = document.getElementById('inp-ms-evidence').value;

        // milestone_code is VARCHAR(32) — keep compact: MS-P{phase}-{6-char pilot prefix}-{4-char timestamp}
        const pilotPrefix = (pId || '').replace(/-/g, '').substring(0, 6).toUpperCase();
        const newId = `MS-P${phase}-${pilotPrefix}-${Date.now().toString().slice(-4)}`;

        try {
            if (window.GovApi) {
                const pilot = GovData.pilots.find(item => item.id === pId || item.dbId === pId);
                const backendPilotId = pilot?.dbId || pId;
                await GovApi.createMilestone(backendPilotId, {
                    milestoneCode: newId,
                    phase: phase,
                    name: name,
                    description: desc,
                    dueDate: dueDate,
                    paymentAmount: amount,
                    paymentLinked: amount > 0
                });
            }
        } catch (syncErr) {
            console.warn('Backend milestone sync notice:', syncErr.message);
        }

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: currentUser ? currentUser.name : 'Authorized Officer',
            role: currentUser ? currentUser.role : 'Dept Admin',
            action: 'Milestone Created',
            module: 'Milestones',
            detail: `Created Phase ${phase} milestone deliverable ${newId} (${name}) for ${pId}`
        });

        formAddMilestone.reset();
        toggleMilestoneForm(false);
        await renderMilestoneCards(pId);

        GovUtils.showToast(`Milestone ${newId} added to Phase ${phase} successfully!`, 'success');
    });

    // ─────────────────────────────────────────────────────────────
    // 7. RENDER LEGAL CLAUSES ACCORDION
    // ─────────────────────────────────────────────────────────────
    function renderClauses() {
        if (!clausesAccordion) return;
        clausesAccordion.innerHTML = GovData.agreementClauses.map((cl, idx) => `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-${idx}">
                    <button class="accordion-button ${idx > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${idx}">
                        <i class="bi bi-shield-check text-primary me-2"></i> Clause ${idx + 1}: ${cl.category}
                    </button>
                </h2>
                <div id="collapse-${idx}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}">
                    <div class="accordion-body small text-secondary">
                        ${cl.text}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ─────────────────────────────────────────────────────────────
    // 8. VIEW BILATERAL LEGAL AGREEMENT PRINTABLE DRAFT
    // ─────────────────────────────────────────────────────────────
    btnViewAgreement?.addEventListener('click', () => {
        const pId = selPilot.value;
        const p = GovData.pilots.find(item => item.dbId === pId || item.id === pId);
        if (!p) return;
        const su = { name: p.startup || p.startupId || 'Innovator Entity' };
        // Use live milestones cached from the last renderMilestoneCards call
        const pMilestones = p._backendMilestones || GovData.milestones.filter(m => m.pilotId === p.id);

        const content = `
            <div class="agreement-print-container border p-4 bg-white">
                <div class="text-center pb-3 border-bottom mb-4">
                    <div class="fw-bold" style="font-size: 16px;">GOVERNMENT OF MAHARASHTRA</div>
                    <div class="text-muted small">Maharashtra State Innovation Society &bull; GFR Rule 194 Innovation Procurement Framework</div>
                    <h5 class="fw-bold text-navy mt-2">BILATERAL INNOVATION PILOT & 4-PHASE SANDBOX AGREEMENT</h5>
                    <small class="font-monospace text-muted">Contract Ref: GC-AGR-2026-${p.id}</small>
                </div>

                <p class="small">This Agreement is executed between the <strong>Department of ${p.challengeId || 'Innovation & Technology'}</strong>, Government of Maharashtra, and <strong>${su.name}</strong> (hereinafter "Innovator").</p>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">1. Scope of Trial Sandbox</h6>
                <p class="small">The Innovator is authorized to deploy the <strong>${p.name}</strong> in the designated test zone at <strong>${p.location}</strong> for a duration of <strong>${p.duration}</strong> commencing on ${GovUtils.formatDate(p.startDate)}.</p>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">2. Core Legal Covenants</h6>
                <ol class="small text-secondary ps-3">
                    ${GovData.agreementClauses.map(cl => `<li class="mb-2"><strong>${cl.category}:</strong> ${cl.text}</li>`).join('')}
                </ol>

                <h6 class="fw-bold text-navy mt-3 border-bottom pb-1">3. 4-Phase Milestone Schedule & Escrow Payouts</h6>
                <table class="table table-sm table-bordered small mt-2">
                    <thead class="table-light">
                        <tr><th>Phase</th><th>Milestone ID</th><th>Deliverable Description</th><th>Due Date</th><th>Escrow Tranche</th></tr>
                    </thead>
                    <tbody>
                        ${pMilestones.map(m => `
                            <tr>
                                <td><span class="badge phase-pill-${m.phase || 1}">Phase ${m.phase || 1}</span></td>
                                <td>${m.id}</td>
                                <td><strong>${m.name}</strong><br><small class="text-muted">${m.description}</small></td>
                                <td>${GovUtils.formatDate(m.dueDate)}</td>
                                <td class="fw-bold text-navy">${GovUtils.formatCurrency(m.paymentAmount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="row pt-4 mt-4 border-top text-center small">
                    <div class="col-6">
                        <div class="mb-4">_______________________________</div>
                        <strong>Authorized Department Officer</strong><br>
                        Government of Maharashtra
                    </div>
                    <div class="col-6">
                        <div class="mb-4">_______________________________</div>
                        <strong>Authorized Signatory</strong><br>
                        ${su.name}
                    </div>
                </div>

                <div class="text-end mt-4 pt-3 border-top no-print">
                    <button class="btn btn-outline-dark btn-sm me-2" onclick="window.print()"><i class="bi bi-printer me-1"></i> Print / Save PDF</button>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`Bilateral Pilot Agreement — ${p.name}`, content);
    });

    selPilot?.addEventListener('change', async (e) => {
        await renderMilestoneCards(e.target.value);
    });

    // ─────────────────────────────────────────────────────────────
    // 9. INITIALIZATION
    // ─────────────────────────────────────────────────────────────
    await populatePilots();
    renderClauses();
    if (GovData.pilots.length > 0) {
        const initial = GovData.pilots.find(p => p.dbId === prePilotId || p.id === prePilotId) || GovData.pilots[0];
        const initialPilotId = initial.dbId || initial.id;
        if (selPilot) selPilot.value = initialPilotId;
        await renderMilestoneCards(initialPilotId);
    }
});

