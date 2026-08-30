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
                }
            } catch (e) {
                console.log('Pilots fetch notice:', e.message);
            }
        }

        if (selPilot) {
            selPilot.innerHTML = pilots.map(p => `
                <option value="${p.id}" ${p.id === prePilotId || p.dbId === prePilotId ? 'selected' : ''}>
                    [${p.id}] ${p.name} (${p.status})
                </option>
            `).join('');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. AUTO-PROVISION STANDARD 4-PHASE MILESTONES FOR A PILOT
    // ─────────────────────────────────────────────────────────────
    function autoProvision4Phases(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId || item.dbId === pilotId);
        if (!p) return;

        // Remove existing milestones for this pilot if resetting
        GovData.milestones = GovData.milestones.filter(m => m.pilotId !== pilotId);

        const now = new Date();
        const d1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const d2 = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const d3 = new Date(now.getTime() + 65 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const d4 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const standard4 = [
            {
                id: `MS-${pilotId}-01`,
                pilotId: pilotId,
                phase: 1,
                name: 'Bilateral Agreement, Legal Indemnity & Testbed Scoping',
                description: 'Execute GFR Rule 194 bilateral charter, sign IP ownership & confidentiality clauses, configure isolated sandbox perimeter.',
                status: 'Completed',
                dueDate: d1,
                completedDate: new Date().toISOString().split('T')[0],
                paymentLinked: true,
                paymentAmount: 100000,
                evidenceType: 'Validator Sign-Off'
            },
            {
                id: `MS-${pilotId}-02`,
                pilotId: pilotId,
                phase: 2,
                name: 'System Deployment & Telemetry Ingestion Setup',
                description: 'Deploy IoT hardware sensors / AI models, establish automated telemetry pipeline and CERT-In security scan clearance.',
                status: 'In Progress',
                dueDate: d2,
                completedDate: null,
                paymentLinked: true,
                paymentAmount: 150000,
                evidenceType: 'System Audit Logs'
            },
            {
                id: `MS-${pilotId}-03`,
                pilotId: pilotId,
                phase: 3,
                name: 'Live Operational Field Trials & 100-Run Dataset Validation',
                description: 'Execute live operational runs in designated testbed, collect multi-source telemetry data, conduct mid-term performance check.',
                status: 'Pending',
                dueDate: d3,
                completedDate: null,
                paymentLinked: true,
                paymentAmount: 150000,
                evidenceType: 'GPS Telematics Trace'
            },
            {
                id: `MS-${pilotId}-04`,
                pilotId: pilotId,
                phase: 4,
                name: 'Comprehensive M&E Report & Independent Audit Sign-Off',
                description: 'Submit 22-section final evaluation report, obtain Section 65B validator certification, formulate GeM scale-up bid draft.',
                status: 'Pending',
                dueDate: d4,
                completedDate: null,
                paymentLinked: true,
                paymentAmount: 100000,
                evidenceType: 'Citizen Audit Report'
            }
        ];

        GovData.milestones.unshift(...standard4);

        // Sync corresponding payments
        standard4.forEach((ms, idx) => {
            const payId = `PAY-${pilotId}-${idx + 1}`;
            if (!GovData.payments.some(pay => pay.milestoneId === ms.id)) {
                GovData.payments.unshift({
                    id: payId,
                    milestoneId: ms.id,
                    pilotId: pilotId,
                    amount: ms.paymentAmount,
                    status: ms.status === 'Completed' ? 'Released' : 'In Escrow',
                    requestDate: ms.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
                    approvalDate: ms.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
                    releaseDate: ms.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
                    escrowHeld: ms.status !== 'Completed'
                });
            }
        });

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: currentUser ? currentUser.name : 'Authorized Officer',
            role: currentUser ? currentUser.role : 'Dept Admin',
            action: '4-Phase Schedule Created',
            module: 'Milestones',
            detail: `Auto-provisioned standard 4-phase GFR 194 milestone contract schedule for ${pilotId}`
        });

        renderMilestoneCards(pilotId);
        GovUtils.showToast(`Standard 4-Phase milestone schedule configured for ${pilotId}!`, 'success');
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
            const completed = phMilestones.filter(m => m.status === 'Completed').length;
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
    async function renderMilestoneCards(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId || item.dbId === pilotId);
        if (!p) return;

        const su = GovData.startups.find(s => s.id === p.startupId) || { name: p.startupId, sector: 'GovTech' };
        if (partnerName) partnerName.textContent = `${su.name || p.startupId} · ${p.location || 'Maharashtra Sandbox'}`;
        if (pilotStatusBadge) pilotStatusBadge.textContent = p.status || 'Active Sandbox';

        // Try loading KPIs and evidences from backend
        let backendKpis = [];
        let backendEvidences = [];
        const dbId = p.dbId || pilotId;
        try {
            if (window.GovApi) {
                const [kpiRes, evRes] = await Promise.all([
                    GovApi.getPilotKpis(dbId).catch(() => null),
                    GovApi.getPilotEvidences(dbId).catch(() => null)
                ]);
                if (kpiRes && kpiRes.success && Array.isArray(kpiRes.data)) backendKpis = kpiRes.data;
                if (evRes && evRes.success && Array.isArray(evRes.data)) backendEvidences = evRes.data;
            }
        } catch (e) {
            console.warn('Backend KPI/evidence fetch fallback:', e.message);
        }

        // Store backend data for use in milestone cards
        p._backendKpis = backendKpis;
        p._backendEvidences = backendEvidences;

        // Filter milestones for this pilot
        const pMilestones = GovData.milestones.filter(m => m.pilotId === pilotId);

        // Update stats
        const total = pMilestones.length;
        const completed = pMilestones.filter(m => m.status === 'Completed').length;
        const totalEscrow = pMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);

        if (statTotalMilestones) statTotalMilestones.textContent = total;
        if (statCompletedMilestones) statCompletedMilestones.textContent = `${completed} / ${total}`;
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
                            const stateClass = m.status === 'Completed' ? 'state-completed' : (m.status === 'In Progress' ? 'state-inprogress' : (m.status === 'Under Review' ? 'state-inprogress' : 'state-pending'));
                            const badgeClass = m.status === 'Completed' ? 'state-badge-completed' : (m.status === 'In Progress' ? 'state-badge-inprogress' : (m.status === 'Under Review' ? 'bg-info text-dark' : 'state-badge-pending'));

                            let nextActionBtn = '';
                            if (m.status === 'Pending') {
                                nextActionBtn = `<button class="btn btn-sm btn-outline-primary btn-advance" data-id="${m.id}" data-next="In Progress"><i class="bi bi-play-circle me-1"></i> Start Execution</button>`;
                            } else if (m.status === 'In Progress') {
                                nextActionBtn = `<button class="btn btn-sm btn-outline-warning btn-advance" data-id="${m.id}" data-next="Under Review"><i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable</button>`;
                            } else if (m.status === 'Under Review') {
                                nextActionBtn = `<button class="btn btn-sm btn-success btn-advance" data-id="${m.id}" data-next="Completed"><i class="bi bi-shield-fill-check me-1"></i> Verify & Disburse</button>`;
                            } else {
                                nextActionBtn = `<span class="text-success small fw-bold"><i class="bi bi-patch-check-fill me-1"></i> Verified & Paid</span>`;
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

        // Bind advance buttons
        document.querySelectorAll('.btn-advance').forEach(btn => {
            btn?.addEventListener('click', () => {
                const mId = btn.dataset.id;
                const nextState = btn.dataset.next;
                advanceMilestoneState(mId, nextState);
            });
        });
    }

    window.openAddModalForPhase = function(phId) {
        const phaseSelect = document.getElementById('inp-ms-phase');
        if (phaseSelect) phaseSelect.value = phId;
        toggleMilestoneForm(true);
    };

    // ─────────────────────────────────────────────────────────────
    // 5. STATE MACHINE ADVANCE LOGIC
    // ─────────────────────────────────────────────────────────────
    function advanceMilestoneState(mId, nextState) {
        const m = GovData.milestones.find(item => item.id === mId);
        if (!m) return;

        m.status = nextState;
        if (nextState === 'Completed') {
            m.completedDate = new Date().toISOString().split('T')[0];

            // If payment linked, update payment status in GovData.payments
            let pay = GovData.payments.find(p => p.milestoneId === mId);
            if (pay) {
                pay.status = 'Released';
                pay.approvalDate = new Date().toISOString().split('T')[0];
                pay.releaseDate = new Date().toISOString().split('T')[0];
                pay.escrowHeld = false;
            } else if (m.paymentLinked && m.paymentAmount > 0) {
                GovData.payments.unshift({
                    id: `PAY-${m.id}`,
                    milestoneId: m.id,
                    pilotId: m.pilotId,
                    amount: m.paymentAmount,
                    status: 'Released',
                    requestDate: new Date().toISOString().split('T')[0],
                    approvalDate: new Date().toISOString().split('T')[0],
                    releaseDate: new Date().toISOString().split('T')[0],
                    escrowHeld: false
                });
            }
        }

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: currentUser ? currentUser.name : 'Authorized Officer',
            role: currentUser ? currentUser.role : 'Dept Admin',
            action: 'Milestone Advanced',
            module: 'Milestones',
            detail: `Advanced milestone ${m.id} (${m.name}) to state: ${nextState}`
        });

        renderMilestoneCards(selPilot.value);
        GovUtils.showToast(`Milestone ${m.id} transitioned to "${nextState}"!`, 'success');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. ADD NEW MILESTONE FORM SUBMIT
    // ─────────────────────────────────────────────────────────────
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

        const newId = `MS-${pId}-P${phase}-${Date.now().toString().slice(-4)}`;

        const newMilestone = {
            id: newId,
            pilotId: pId,
            phase: phase,
            name: name,
            description: desc,
            status: 'Pending',
            dueDate: dueDate,
            completedDate: null,
            paymentLinked: amount > 0,
            paymentAmount: amount,
            evidenceType: evidence
        };

        GovData.milestones.push(newMilestone);

        // Add payment escrow record if payment linked
        if (amount > 0) {
            GovData.payments.push({
                id: `PAY-${newId}`,
                milestoneId: newId,
                pilotId: pId,
                amount: amount,
                status: 'In Escrow',
                requestDate: null,
                approvalDate: null,
                releaseDate: null,
                escrowHeld: true
            });
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
        renderMilestoneCards(pId);

        // Sync new milestone to backend as a pilot evidence record
        try {
            if (window.GovApi) {
                const pilot = GovData.pilots.find(item => item.id === pId || item.dbId === pId);
                const backendPilotId = pilot?.dbId || pId;
                await GovApi.submitPilotEvidence(backendPilotId, {
                    title: `Phase ${phase}: ${name}`,
                    description: desc,
                    evidenceType: evidence || 'milestone_deliverable',
                    milestoneRef: newId
                });
            }
        } catch (syncErr) {
            console.warn('Backend milestone sync notice:', syncErr.message);
        }

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
        const p = GovData.pilots.find(item => item.id === pId || item.dbId === pId);
        if (!p) return;
        const su = GovData.startups.find(s => s.id === p.startupId) || { name: p.startupId, founders: 'Startup Founders' };
        const pMilestones = GovData.milestones.filter(m => m.pilotId === pId);

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
        const initialPilotId = selPilot.value || GovData.pilots[0].id;
        await renderMilestoneCards(initialPilotId);
    }
});

