const fs = require('fs');

const path = 'c:/Users/Gagan upadhyaya/OneDrive/Desktop/GovCatalyst/docs/milestones.js';
let content = fs.readFileSync(path, 'utf-8');

const targetFunc = `    function renderMilestoneCards(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId || item.dbId === pilotId);
        if (!p) return;

        const su = GovData.startups.find(s => s.id === p.startupId) || { name: p.startupId, sector: 'GovTech' };
        if (partnerName) partnerName.textContent = \`\${su.name || p.startupId} · \${p.location || 'Maharashtra Sandbox'}\`;
        if (pilotStatusBadge) pilotStatusBadge.textContent = p.status || 'Active Sandbox';

        // Filter milestones for this pilot
        const pMilestones = GovData.milestones.filter(m => m.pilotId === pilotId);

        // Update stats
        const total = pMilestones.length;
        const completed = pMilestones.filter(m => m.status === 'Completed').length;
        const totalEscrow = pMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);

        if (statTotalMilestones) statTotalMilestones.textContent = total;
        if (statCompletedMilestones) statCompletedMilestones.textContent = \`\${completed} / \${total}\`;
        if (statEscrowAmount) statEscrowAmount.textContent = GovUtils.formatCurrency(totalEscrow);

        renderPipeline(pMilestones);

        if (!pMilestones.length) {
            cardsContainer.innerHTML = \`
                <div class="col-12 text-center py-5 bg-light rounded border">
                    <i class="bi bi-diagram-3 fs-1 text-secondary mb-3 d-block"></i>
                    <h5 class="fw-bold text-navy">No Milestones Defined for \${p.name}</h5>
                    <p class="text-muted small mb-3">Set up the 4-phase legal contracting lifecycle for this sandbox pilot.</p>
                    <button class="btn btn-gold btn-sm me-2" onclick="document.getElementById('btn-auto-4phases').click()">
                        <i class="bi bi-lightning-charge-fill me-1"></i> Auto-Set 4 Phases (Recommended)
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="document.getElementById('btn-toggle-milestone-form').click()">
                        <i class="bi bi-plus-circle me-1"></i> Add Custom Milestone
                    </button>
                </div>
            \`;
            return;
        }

        // Group milestones into the 4 Phases
        let html = '';
        PHASES.forEach(ph => {
            const phMilestones = pMilestones.filter(m => (m.phase || 1) === ph.id);
            const phEscrow = phMilestones.reduce((s, m) => s + (m.paymentAmount || 0), 0);
            const phCompleted = phMilestones.filter(m => m.status === 'Completed').length;

            html += \`
                <div class="phase-container mb-4">
                    <div class="phase-section-header">
                        <div>
                            <span class="badge phase-pill-\${ph.id} fw-bold me-2 font-monospace">PHASE \${ph.id}</span>
                            <strong class="text-navy">\${ph.name}</strong>
                            <small class="text-muted d-block ms-1 mt-1" style="font-size: 11px;">\${ph.desc}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-secondary font-monospace">\${phCompleted}/\${phMilestones.length} Done</span>
                            <span class="badge bg-light text-dark border ms-1">\${GovUtils.formatCurrency(phEscrow)} Escrow</span>
                        </div>
                    </div>

                    <div class="row g-3">
                        \${phMilestones.length === 0 ? \`
                            <div class="col-12">
                                <div class="p-3 bg-light rounded text-muted small text-center border-dashed">
                                    No milestones in Phase \${ph.id}. <a href="javascript:void(0)" onclick="openAddModalForPhase(\${ph.id})" class="text-primary fw-semibold">+ Add Phase \${ph.id} Milestone</a>
                                </div>
                            </div>
                        \` : phMilestones.map(m => {
                            const stateClass = m.status === 'Completed' ? 'state-completed' : (m.status === 'In Progress' ? 'state-inprogress' : (m.status === 'Under Review' ? 'state-inprogress' : 'state-pending'));
                            const badgeClass = m.status === 'Completed' ? 'state-badge-completed' : (m.status === 'In Progress' ? 'state-badge-inprogress' : (m.status === 'Under Review' ? 'bg-info text-dark' : 'state-badge-pending'));

                            let nextActionBtn = '';
                            if (m.status === 'Pending') {
                                nextActionBtn = \`<button class="btn btn-sm btn-outline-primary btn-advance" data-id="\${m.id}" data-next="In Progress"><i class="bi bi-play-circle me-1"></i> Start Execution</button>\`;
                            } else if (m.status === 'In Progress') {
                                nextActionBtn = \`<button class="btn btn-sm btn-outline-warning btn-advance" data-id="\${m.id}" data-next="Under Review"><i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable</button>\`;
                            } else if (m.status === 'Under Review') {
                                nextActionBtn = \`<button class="btn btn-sm btn-success btn-advance" data-id="\${m.id}" data-next="Completed"><i class="bi bi-shield-fill-check me-1"></i> Verify & Disburse</button>\`;
                            } else {
                                nextActionBtn = \`<span class="text-success small fw-bold"><i class="bi bi-patch-check-fill me-1"></i> Verified & Paid</span>\`;
                            }

                            return \`
                                <div class="col-md-6">
                                    <div class="gov-card milestone-card \${stateClass} h-100 mb-0">
                                        <div class="gov-card-body">
                                            <div class="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <span class="badge bg-secondary font-monospace" style="font-size: 11px;">\${m.id}</span>
                                                    <span class="badge \${badgeClass} ms-1" style="font-size: 11px;">\${m.status}</span>
                                                    <span class="badge bg-light text-dark border ms-1" style="font-size: 10px;">Phase \${m.phase || ph.id}</span>
                                                </div>
                                                <strong class="text-navy">\${GovUtils.formatCurrency(m.paymentAmount)}</strong>
                                            </div>

                                            <h6 class="fw-bold text-navy mb-1">\${m.name}</h6>
                                            <p class="small text-secondary mb-2" style="font-size: 12px;">\${m.description}</p>

                                            <div class="p-2 bg-light rounded small mb-2 text-muted" style="font-size: 11px;">
                                                <i class="bi bi-file-earmark-check text-primary me-1"></i>
                                                <strong>Evidence Required:</strong> \${m.evidenceType || 'System Audit Logs / Telemetry'}
                                            </div>

                                            <div class="row g-1 small border-top pt-2 text-muted mb-2" style="font-size: 11px;">
                                                <div class="col-6"><strong>Due:</strong> \${GovUtils.formatDate(m.dueDate)}</div>
                                                <div class="col-6"><strong>Completed:</strong> \${m.completedDate ? GovUtils.formatDate(m.completedDate) : '—'}</div>
                                            </div>

                                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                                <small class="text-muted">Escrow: <strong>\${m.paymentLinked ? 'Linked' : 'None'}</strong></small>
                                                <div>\${nextActionBtn}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        }).join('')}
                    </div>
                </div>
            \`;
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
    }`;

const replaceFunc = `    async function renderMilestoneCards(pilotId) {
        const p = GovData.pilots.find(item => item.id === pilotId || item.dbId === pilotId);
        if (!p) return;

        const su = GovData.startups.find(s => s.id === p.startupId) || { name: p.startupId, sector: 'GovTech' };
        if (partnerName) partnerName.textContent = \`\${su.name || p.startupId} · \${p.location || 'Maharashtra Sandbox'}\`;
        if (pilotStatusBadge) pilotStatusBadge.textContent = p.status || 'Active Sandbox';

        // Filter milestones for this pilot
        const pMilestones = GovData.milestones.filter(m => m.pilotId === pilotId);

        let pKpis = [];
        let pEvidences = [];
        try {
            if (window.GovApi) {
                const [kpiRes, evRes] = await Promise.all([
                    GovApi.getPilotKpis(p.dbId || pilotId),
                    GovApi.getPilotEvidences(p.dbId || pilotId)
                ]);
                if (kpiRes && kpiRes.success) pKpis = kpiRes.data || [];
                if (evRes && evRes.success) pEvidences = evRes.data || [];
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }

        // Update stats
        const total = pMilestones.length;
        const completed = pMilestones.filter(m => m.status === 'Completed').length;
        const totalEscrow = pMilestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);

        if (statTotalMilestones) statTotalMilestones.textContent = total;
        if (statCompletedMilestones) statCompletedMilestones.textContent = \`\${completed} / \${total}\`;
        if (statEscrowAmount) statEscrowAmount.textContent = GovUtils.formatCurrency(totalEscrow);

        renderPipeline(pMilestones);

        if (!pMilestones.length) {
            cardsContainer.innerHTML = \`
                <div class="col-12 text-center py-5 bg-light rounded border">
                    <i class="bi bi-diagram-3 fs-1 text-secondary mb-3 d-block"></i>
                    <h5 class="fw-bold text-navy">No Milestones Defined for \${p.name}</h5>
                    <p class="text-muted small mb-3">Set up the 4-phase legal contracting lifecycle for this sandbox pilot.</p>
                    <button class="btn btn-gold btn-sm me-2" onclick="document.getElementById('btn-auto-4phases').click()">
                        <i class="bi bi-lightning-charge-fill me-1"></i> Auto-Set 4 Phases (Recommended)
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="document.getElementById('btn-toggle-milestone-form').click()">
                        <i class="bi bi-plus-circle me-1"></i> Add Custom Milestone
                    </button>
                </div>
            \`;
            return;
        }

        // Group milestones into the 4 Phases
        let html = '';
        PHASES.forEach(ph => {
            const phMilestones = pMilestones.filter(m => (m.phase || 1) === ph.id);
            const phEscrow = phMilestones.reduce((s, m) => s + (m.paymentAmount || 0), 0);
            const phCompleted = phMilestones.filter(m => m.status === 'Completed').length;

            html += \`
                <div class="phase-container mb-4">
                    <div class="phase-section-header">
                        <div>
                            <span class="badge phase-pill-\${ph.id} fw-bold me-2 font-monospace">PHASE \${ph.id}</span>
                            <strong class="text-navy">\${ph.name}</strong>
                            <small class="text-muted d-block ms-1 mt-1" style="font-size: 11px;">\${ph.desc}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-secondary font-monospace">\${phCompleted}/\${phMilestones.length} Done</span>
                            <span class="badge bg-light text-dark border ms-1">\${GovUtils.formatCurrency(phEscrow)} Escrow</span>
                        </div>
                    </div>

                    <div class="row g-3">
                        \${phMilestones.length === 0 ? \`
                            <div class="col-12">
                                <div class="p-3 bg-light rounded text-muted small text-center border-dashed">
                                    No milestones in Phase \${ph.id}. <a href="javascript:void(0)" onclick="openAddModalForPhase(\${ph.id})" class="text-primary fw-semibold">+ Add Phase \${ph.id} Milestone</a>
                                </div>
                            </div>
                        \` : phMilestones.map(m => {
                            const stateClass = m.status === 'Completed' ? 'state-completed' : (m.status === 'In Progress' ? 'state-inprogress' : (m.status === 'Under Review' ? 'state-inprogress' : 'state-pending'));
                            const badgeClass = m.status === 'Completed' ? 'state-badge-completed' : (m.status === 'In Progress' ? 'state-badge-inprogress' : (m.status === 'Under Review' ? 'bg-info text-dark' : 'state-badge-pending'));

                            let nextActionBtn = '';
                            if (m.status === 'Pending') {
                                nextActionBtn = \`<button class="btn btn-sm btn-outline-primary btn-advance" data-id="\${m.id}" data-next="In Progress"><i class="bi bi-play-circle me-1"></i> Start Execution</button>\`;
                            } else if (m.status === 'In Progress') {
                                nextActionBtn = \`<button class="btn btn-sm btn-outline-warning btn-advance" data-id="\${m.id}" data-next="Under Review"><i class="bi bi-cloud-arrow-up-fill me-1"></i> Submit Deliverable</button>\`;
                            } else if (m.status === 'Under Review') {
                                nextActionBtn = \`<button class="btn btn-sm btn-success btn-advance" data-id="\${m.id}" data-next="Completed"><i class="bi bi-shield-fill-check me-1"></i> Verify & Disburse</button>\`;
                            } else {
                                nextActionBtn = \`<span class="text-success small fw-bold"><i class="bi bi-patch-check-fill me-1"></i> Verified & Paid</span>\`;
                            }
                            
                            const evList = pEvidences.filter(e => e.milestoneRef === m.id);
                            const evHtml = evList.length > 0 ? \`<br><i class="bi bi-paperclip text-success me-1"></i><strong>Submitted:</strong> \` + evList.map(e => e.fileUrl ? \`<a href="\${e.fileUrl}" target="_blank">\${e.title}</a>\` : e.title).join(', ') : '';
                            const kpiHtml = (pKpis.length > 0 && (m.status === 'In Progress' || m.status === 'Under Review')) ? \`<div class="mt-2 border-top pt-2"><strong class="text-navy small">Live KPIs:</strong> <div class="mt-1">\` + pKpis.map(k => \`<span class="badge bg-light text-dark border me-1 mb-1">\${k.name}: \${k.currentValue || 0}/\${k.targetValue || 100}</span>\`).join('') + \`</div></div>\` : '';

                            return \`
                                <div class="col-md-6">
                                    <div class="gov-card milestone-card \${stateClass} h-100 mb-0">
                                        <div class="gov-card-body">
                                            <div class="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <span class="badge bg-secondary font-monospace" style="font-size: 11px;">\${m.id}</span>
                                                    <span class="badge \${badgeClass} ms-1" style="font-size: 11px;">\${m.status}</span>
                                                    <span class="badge bg-light text-dark border ms-1" style="font-size: 10px;">Phase \${m.phase || ph.id}</span>
                                                </div>
                                                <strong class="text-navy">\${GovUtils.formatCurrency(m.paymentAmount)}</strong>
                                            </div>

                                            <h6 class="fw-bold text-navy mb-1">\${m.name}</h6>
                                            <p class="small text-secondary mb-2" style="font-size: 12px;">\${m.description}</p>

                                            <div class="p-2 bg-light rounded small mb-2 text-muted" style="font-size: 11px;">
                                                <i class="bi bi-file-earmark-check text-primary me-1"></i>
                                                <strong>Evidence Required:</strong> \${m.evidenceType || 'System Audit Logs / Telemetry'}
                                                \${evHtml}
                                            </div>
                                            
                                            \${kpiHtml}

                                            <div class="row g-1 small border-top pt-2 text-muted mb-2" style="font-size: 11px;">
                                                <div class="col-6"><strong>Due:</strong> \${GovUtils.formatDate(m.dueDate)}</div>
                                                <div class="col-6"><strong>Completed:</strong> \${m.completedDate ? GovUtils.formatDate(m.completedDate) : '—'}</div>
                                            </div>

                                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                                <small class="text-muted">Escrow: <strong>\${m.paymentLinked ? 'Linked' : 'None'}</strong></small>
                                                <div>\${nextActionBtn}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        }).join('')}
                    </div>
                </div>
            \`;
        });

        cardsContainer.innerHTML = html;

        // Bind advance buttons
        document.querySelectorAll('.btn-advance').forEach(btn => {
            btn?.addEventListener('click', () => {
                const mId = btn.dataset.id;
                const nextState = btn.dataset.next;
                if (nextState === 'Under Review') {
                    promptEvidenceSubmission(mId, p.dbId || pilotId);
                } else {
                    advanceMilestoneState(mId, nextState);
                }
            });
        });
    }

    function promptEvidenceSubmission(mId, dbId) {
        const content = \`
            <div class="p-3">
                <div class="mb-3">
                    <label class="form-label small fw-bold">Evidence Title</label>
                    <input type="text" id="ev-title" class="form-control form-control-sm" placeholder="e.g., Q3 Telemetry Report" required>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Description</label>
                    <textarea id="ev-desc" class="form-control form-control-sm" rows="2"></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Upload File (Optional)</label>
                    <input type="file" id="ev-file" class="form-control form-control-sm">
                </div>
                <div class="text-end mt-4">
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Cancel</button>
                    <button class="btn btn-primary btn-sm ms-2" id="btn-submit-ev" onclick="window.submitEvidenceData('\${mId}', '\${dbId}')">Submit Deliverable</button>
                </div>
            </div>
        \`;
        GovUtils.openModal(\`Submit Evidence for \${mId}\`, content);
    }

    window.submitEvidenceData = async function(mId, dbId) {
        const title = document.getElementById('ev-title').value;
        const desc = document.getElementById('ev-desc').value;
        const fileInput = document.getElementById('ev-file');
        const m = GovData.milestones.find(item => item.id === mId);
        
        if (!title) {
            GovUtils.showToast('Please provide a title.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-ev');
        if (btn) { btn.disabled = true; btn.innerHTML = 'Uploading...'; }

        let fileUrl = '';
        try {
            if (window.GovApi) {
                if (fileInput.files && fileInput.files.length > 0) {
                    const uploadRes = await GovApi.uploadFile(fileInput.files[0]);
                    if (uploadRes && uploadRes.success) {
                        fileUrl = uploadRes.url;
                    }
                }
                const res = await GovApi.submitPilotEvidence(dbId, {
                    title: title,
                    description: desc,
                    fileUrl: fileUrl,
                    evidenceType: m ? m.evidenceType : 'Deliverable',
                    milestoneRef: mId
                });
                if (res && res.success) {
                    GovUtils.showToast('Evidence submitted successfully!', 'success');
                }
            }
        } catch (e) {
            console.warn('Backend unavailable, using local fallback:', e.message);
        }
        
        GovUtils.closeModal();
        advanceMilestoneState(mId, 'Under Review');
    };`;

content = content.replace(targetFunc, replaceFunc);
fs.writeFileSync(path, content, 'utf-8');
console.log('done');
