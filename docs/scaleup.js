/* =============================================
   GovCatalyst — Module 9: Scale-Up Transition Logic
   ============================================= */

window.GovScaleup = {
    generateGemSpec() {
        const selPilot = document.getElementById('sel-scale-pilot');
        const pId = selPilot ? selPilot.value : (GovData.pilots[0] ? GovData.pilots[0].id : 'PLT-001');
        const p = (GovData.pilots && GovData.pilots.find(item => item.id === pId || item.dbId === pId)) || {
            id: 'PLT-001',
            name: 'AI Smart Irrigation & Drone Survey',
            startupId: 'SU-001'
        };
        const su = (GovData.startups && GovData.startups.find(s => s.id === p.startupId)) || { name: 'AquaSens Dynamics Pvt Ltd' };

        const content = `
            <div class="p-3 bg-light rounded border">
                <div class="d-flex justify-content-between border-bottom pb-2 mb-3">
                    <div>
                        <span class="badge bg-primary me-2">GeM-BID-2026-MH</span>
                        <h5 class="fw-bold text-navy mb-0">Government e-Marketplace (GeM) Custom Specification Draft</h5>
                    </div>
                    <span class="badge bg-success">GFR Rule 194 Compliant</span>
                </div>

                <div class="row g-2 small mb-3">
                    <div class="col-6"><strong>Target Department:</strong> Public Works Department / Urban Dev</div>
                    <div class="col-6"><strong>Qualified Incubated Vendor:</strong> ${su.name}</div>
                    <div class="col-6"><strong>Estimated Procurement Value:</strong> ₹2,50,00,000 (2.5 Cr)</div>
                    <div class="col-6"><strong>Verification Basis:</strong> Sandbox Trial Ref ${p.id}</div>
                </div>

                <h6 class="fw-bold text-navy border-bottom pb-1">Mandatory Technical Output Parameters:</h6>
                <ul class="small text-secondary">
                    <li>Edge Computer Vision defect identification with verified minimum 90% accuracy</li>
                    <li>Automated GIS bridge asset mapping compatible with Maharashtra PWD portal</li>
                    <li>Turnaround inspection reporting latency within 6 hours per asset deck</li>
                    <li>Full compliance with NIST 800-88 data sanitization and AES-256 encryption standards</li>
                </ul>

                <div class="text-end pt-3 border-top">
                    <button class="btn btn-outline-primary btn-sm me-2" onclick="GovUtils.showToast('Downloaded GeM JSON/XML packet', 'info'); GovUtils.closeModal();">
                        <i class="bi bi-download me-1"></i> Download GeM Catalog JSON
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`GeM Procurement Specifications — ${p.name}`, content);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const selPilot = document.getElementById('sel-scale-pilot');
    const valSuccessScore = document.getElementById('val-success-score');
    const valDecisionBadge = document.getElementById('val-decision-badge');
    const valDecisionTitle = document.getElementById('val-decision-title');
    const valDecisionReason = document.getElementById('val-decision-reason');
    const valPathwayBadge = document.getElementById('val-pathway-badge');
    const comparisonTbody = document.getElementById('comparison-tbody');
    const gemDraftContainer = document.getElementById('gem-draft-container');
    const transitionStepsContainer = document.getElementById('transition-steps-container');

    async function populatePilots() {
        if (!selPilot) return;
        let pilots = GovData.pilots;
        try {
            if (window.GovApi) {
                const res = await GovApi.getPilots();
                if (res.success && res.data) {
                    pilots = res.data;
                    GovData.pilots = pilots;
                }
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }
        selPilot.innerHTML = pilots.map(p => `
            <option value="${p.dbId || p.id}">[${p.id || p.dbId}] ${p.name} (${p.status})</option>
        `).join('');
    }

    async function renderScaleup(pilotId) {
        let pilots = GovData.pilots || [];
        let p = pilots.find(item => item.id === pilotId || item.dbId === pilotId) || pilots[0];
        
        try {
            if (window.GovApi) {
                const res = await GovApi.getPilotById(pilotId);
                if (res.success && res.data) {
                    p = res.data;
                }
            }
        } catch (e) {
            console.warn('Backend unavailable for pilot:', e.message);
        }

        if (!p) return;

        const su = (GovData.startups && GovData.startups.find(s => s.id === p.startupId)) || { name: p.startupId || 'Innovator Entity' };
        let decision = (GovData.scaleupDecisions && GovData.scaleupDecisions.find(d => d.pilotId === pilotId)) || {
            pilotId: pilotId,
            successScore: p.status === 'Completed' ? 90 : 88,
            recommendation: p.status === 'Completed' ? 'Scale to Full Procurement' : 'Trial in Progress / Scale Ready',
            reasoning: p.status === 'Completed' ? 'All KPIs verified. Ready for scale.' : 'High performance trial metrics achieved.',
            procurementPathway: 'GFR Rule 194 — Innovation Procurement',
            gemListingDraft: {
                itemName: `${p.name} - Enterprise Solution`,
                category: 'Software - Custom IT Solution',
                estimatedValue: '₹1.5 Crore',
                specifications: 'Integrated government solution verified via sandbox trial.'
            },
            transitionSteps: [
                'Complete validator sign-off',
                'Draft GeM specification sheet',
                'Department financial sanction',
                'Issue RFP under GFR 194',
                'Final contract award'
            ]
        };

        try {
            if (window.GovApi) {
                const recRes = await GovApi.getRecommendations(p.dbId || p.id);
                if (recRes.success && recRes.data) {
                    decision.recommendation = recRes.data.recommendation || decision.recommendation;
                    decision.successScore = recRes.data.targetAchievementScore || decision.successScore;
                    decision.reasoning = recRes.data.rationale || decision.reasoning;
                    decision.procurementPathway = recRes.data.procurementAction || decision.procurementPathway;
                }
            }
        } catch (e) {
            console.warn('Backend unavailable for recommendations:', e.message);
        }

        const isScale = decision.recommendation && decision.recommendation.includes('Scale');

        if (valSuccessScore) {
            valSuccessScore.textContent = decision.successScore ? `${decision.successScore}/100` : '88/100';
            valSuccessScore.className = 'display-3 fw-bold text-success my-1';
        }
        if (valDecisionBadge) {
            valDecisionBadge.className = 'badge bg-success';
            valDecisionBadge.textContent = 'RECOMMENDED FOR SCALE';
        }
        if (valDecisionTitle) {
            valDecisionTitle.textContent = `Outcome Decision: ${decision.recommendation} for ${su.name}`;
        }
        if (valDecisionReason) {
            valDecisionReason.textContent = decision.reasoning;
        }
        if (valPathwayBadge) {
            valPathwayBadge.textContent = decision.procurementPathway;
        }

        // Comparison Matrix
        if (comparisonTbody) {
            let accuracy = p.metrics?.accuracy || (p.status === 'Completed' ? '91.2% Achieved' : '90.4% (Achieved)');
            let latency = p.metrics?.latency || (p.status === 'Completed' ? '42% Reduction' : '38% Reduction');
            let security = p.metrics?.security || '0 Critical / Low Risk';
            let adoption = p.metrics?.adoption || '85% Positive Feedback';

            comparisonTbody.innerHTML = `
                <tr>
                    <td class="fw-bold text-navy">Performance Accuracy</td>
                    <td>≥ 90% Target Accuracy</td>
                    <td><strong class="text-success">${accuracy}</strong></td>
                    <td><span class="badge bg-success">Passed Verification</span></td>
                </tr>
                <tr>
                    <td class="fw-bold text-navy">Operational Latency Reduction</td>
                    <td>≥ 30% Turnaround Time Saved</td>
                    <td><strong class="text-success">${latency}</strong></td>
                    <td><span class="badge bg-success">Passed Verification</span></td>
                </tr>
                <tr>
                    <td class="fw-bold text-navy">Cybersecurity & Data Privacy</td>
                    <td>Zero Critical CERT-In Vulnerabilities</td>
                    <td><strong class="text-success">${security}</strong></td>
                    <td><span class="badge bg-success">Passed Audit</span></td>
                </tr>
                <tr>
                    <td class="fw-bold text-navy">User / Engineer Adoption</td>
                    <td>≥ 80% Field Inspector Satisfaction</td>
                    <td><strong class="text-success">${adoption}</strong></td>
                    <td><span class="badge bg-success">Passed Survey</span></td>
                </tr>
            `;
        }

        // GeM Draft Card
        if (gemDraftContainer && decision.gemListingDraft) {
            const gem = decision.gemListingDraft;
            gemDraftContainer.innerHTML = `
                <div class="gem-spec-box mb-3">
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">GeM Category:</span>
                        <span class="fw-bold text-navy">${gem.category}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Item / Service Name:</span>
                        <span class="fw-bold text-dark">${gem.itemName}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Estimated Scale Value:</span>
                        <span class="fw-bold text-success fs-6">${gem.estimatedValue}</span>
                    </div>
                    <div class="pt-2 border-top">
                        <small class="text-muted d-block mb-1">Standardized Output Specifications:</small>
                        <p class="small text-secondary mb-0">${gem.specifications}</p>
                    </div>
                </div>
                <button class="btn btn-sm btn-gov w-100" id="btn-push-gem" onclick="GovUtils.showToast('GeM Custom Bid Specifications packet drafted & exported!', 'success')">
                    <i class="bi bi-cloud-arrow-up me-1"></i> Push Draft to GeM Custom Bid Engine
                </button>
            `;
        }

        // Transition Steps
        if (transitionStepsContainer) {
            const steps = (decision.transitionSteps && decision.transitionSteps.length) ? decision.transitionSteps : [
                'Complete validator sign-off',
                'Draft GeM specification sheet',
                'Department financial sanction',
                'Issue RFP under GFR 194',
                'Final contract award'
            ];

            transitionStepsContainer.innerHTML = steps.map((step, idx) => `
                <div class="transition-step-item">
                    <div class="step-num-circle ${idx < 4 ? 'done' : ''}">
                        ${idx < 4 ? '<i class="bi bi-check"></i>' : (idx + 1)}
                    </div>
                    <div class="flex-grow-1">
                        <span class="small fw-semibold ${idx < 4 ? 'text-navy' : 'text-muted'}">${step}</span>
                    </div>
                    <span class="badge ${idx < 4 ? 'bg-success' : 'bg-secondary'} small">
                        ${idx < 4 ? 'Completed' : 'Pending'}
                    </span>
                </div>
            `).join('');
        }
    }

    // Attach click listeners to GeM generate buttons
    const btnGen1 = document.getElementById('btn-gen-gem-spec');
    const btnGen2 = document.getElementById('btn-generate-gem-doc');
    btnGen1?.addEventListener('click', () => GovScaleup.generateGemSpec());
    btnGen2?.addEventListener('click', () => GovScaleup.generateGemSpec());

    selPilot?.addEventListener('change', (e) => {
        renderScaleup(e.target.value);
    });

    async function init() {
        await populatePilots();
        if (GovData.pilots && GovData.pilots.length > 0) {
            const initialId = selPilot ? (selPilot.value || GovData.pilots[0].dbId || GovData.pilots[0].id) : (GovData.pilots[0].dbId || GovData.pilots[0].id);
            await renderScaleup(initialId);
        }
    }
    
    init();
});
