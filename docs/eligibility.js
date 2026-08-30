/* =============================================
   GovCatalyst — Module 3: Eligibility Screening Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const criteriaTbody = document.getElementById('criteria-tbody');
    const selScreeningSu = document.getElementById('sel-screening-su');
    const screeningSuSummary = document.getElementById('screening-su-summary');
    const checklistTbody = document.getElementById('checklist-tbody');
    const checklistCounter = document.getElementById('checklist-counter');
    const verdictBox = document.getElementById('verdict-box');
    const verdictIcon = document.getElementById('verdict-icon');
    const verdictTitle = document.getElementById('verdict-title');
    const verdictDesc = document.getElementById('verdict-desc');
    const batchTbody = document.getElementById('batch-tbody');
    const toggleGlobal = document.getElementById('toggle-global-exemption');

    let exemptionsEnabled = true;

    function getOrCreateScreening(su) {
        let screening = GovData.startupScreenings.find(sc => sc.startupId === su.id);
        if (!screening) {
            const metTurnover = exemptionsEnabled ? su.turnover >= 2500000 : su.turnover >= 100000000;
            const metDpiit = !!su.dpiitNumber && su.dpiitNumber !== 'DIPP-PENDING';
            const metProto = su.stage !== 'Seed' || su.pastPilots > 0;
            const metPilots = exemptionsEnabled ? su.pastPilots >= 1 : su.pastPilots >= 3;
            
            screening = {
                startupId: su.id,
                results: [
                    { criterionId: 'EC-1', rule: 'Annual Turnover', met: metTurnover, value: GovUtils.formatCurrency(su.turnover), notes: metTurnover ? 'Qualifies under relaxed norms' : 'Below relaxed turnover threshold' },
                    { criterionId: 'EC-2', rule: 'Years of Operation', met: true, value: `${2026 - parseInt(su.founded || '2022')} years`, notes: 'Operating with prototype' },
                    { criterionId: 'EC-3', rule: 'DPIIT Recognition', met: metDpiit, value: su.dpiitNumber || 'None', notes: metDpiit ? 'Valid DPIIT Certificate' : 'Pending DPIIT' },
                    { criterionId: 'EC-4', rule: 'Prototype / MVP Readiness', met: metProto, value: su.stage + ' Demo', notes: 'MVP Demonstrated' },
                    { criterionId: 'EC-5', rule: 'Team Credentials', met: true, value: 'Domain Founder', notes: su.founders },
                    { criterionId: 'EC-6', rule: 'Past Government Projects', met: metPilots, value: `${su.pastPilots} pilots`, notes: metPilots ? 'Meets experience track' : 'Insufficient pilots' }
                ],
                overallStatus: (metTurnover && metDpiit && metProto) ? 'ELIGIBLE' : 'NOT ELIGIBLE'
            };
            GovData.startupScreenings.push(screening);
        }
        return screening;
    }

    // Render Rules Matrix Table
    function renderRulesMatrix() {
        criteriaTbody.innerHTML = GovData.eligibilityCriteria.map(ec => `
            <tr>
                <td class="fw-bold text-navy">${ec.name}</td>
                <td><span class="text-danger"><i class="bi bi-x-circle me-1"></i>${ec.standardThreshold}</span></td>
                <td><span class="text-success fw-semibold"><i class="bi bi-check-circle me-1"></i>${ec.relaxedThreshold}</span></td>
                <td><small class="text-muted">${ec.exemptionApplicable ? 'Startup India / DPIIT Order' : 'Mandatory Technical'}</small></td>
                <td class="text-center">
                    <span class="criteria-active-pill">
                        ${exemptionsEnabled || !ec.exemptionApplicable ? '✅ Active Relaxation' : '🔒 Legacy Strict'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // Populate Startup Selector
    function populateStartupSelector() {
        if (!GovData.startups || GovData.startups.length === 0) {
            selScreeningSu.innerHTML = '<option value="">-- No Startups Registered --</option>';
            if (screeningSuSummary) screeningSuSummary.innerHTML = '<div class="text-muted small p-2">No startup entity currently selected.</div>';
            if (checklistTbody) checklistTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No startup selected for eligibility verification.</td></tr>';
            return;
        }
        selScreeningSu.innerHTML = GovData.startups.map(su => `
            <option value="${su.id}">[${su.id}] ${su.name} (${su.sector})</option>
        `).join('');
    }

    // Render Screening for selected startup
    function renderScreeningFor(suId) {
        const su = GovData.startups.find(s => s.id === suId);
        if (!su) return;

        // Render summary
        screeningSuSummary.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h6 class="fw-bold text-navy mb-0">${su.name}</h6>
                    <small class="text-muted"><i class="bi bi-geo-alt"></i> ${su.city} · Stage: <strong>${su.stage}</strong></small>
                </div>
                <span class="badge bg-primary font-monospace">${su.id}</span>
            </div>
            <div class="row g-2 small pt-2 border-top text-secondary">
                <div class="col-6"><strong>Turnover:</strong> ${GovUtils.formatCurrency(su.turnover)}</div>
                <div class="col-6"><strong>DPIIT:</strong> ${su.dpiitNumber || 'None'}</div>
                <div class="col-6"><strong>Pilots:</strong> ${su.pastPilots} Done</div>
                <div class="col-6"><strong>GeM:</strong> ${su.gemRegistered ? 'Yes' : 'No'}</div>
            </div>
        `;

        // Retrieve or compute screening results
        const screening = getOrCreateScreening(su);

        // Checklist Table
        let metCount = 0;
        checklistTbody.innerHTML = GovData.eligibilityCriteria.map(ec => {
            const res = screening.results.find(r => r.criterionId === ec.id) || { met: true, value: 'Verified', notes: 'Standard compliant' };
            if (res.met) metCount++;

            return `
                <tr>
                    <td>
                        <span class="fw-semibold text-navy">${ec.name}</span>
                        <small class="text-muted d-block">${ec.description}</small>
                    </td>
                    <td><span class="font-monospace fw-medium">${res.value}</span></td>
                    <td><small class="text-muted">${res.notes}</small></td>
                    <td class="text-center">
                        ${res.met 
                            ? '<span class="badge bg-success"><i class="bi bi-check-lg"></i> MET</span>'
                            : '<span class="badge bg-danger"><i class="bi bi-x-lg"></i> NOT MET</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        checklistCounter.textContent = `${metCount} of ${GovData.eligibilityCriteria.length} Criteria Passed`;

        // Update Verdict Card
        const isEligible = metCount >= 4 && screening.results.find(r => r.criterionId === 'EC-3')?.met;
        if (isEligible) {
            verdictBox.className = 'p-4 rounded text-center border verdict-eligible';
            verdictIcon.innerHTML = '🛡️ <i class="bi bi-patch-check-fill text-success"></i>';
            verdictTitle.textContent = 'QUALIFIED & ELIGIBLE';
            verdictDesc.textContent = 'Entity satisfies relaxed procurement norms under DPIIT & Startup India framework. Permitted to participate in Sandbox & Pilots.';
        } else {
            verdictBox.className = 'p-4 rounded text-center border verdict-not-eligible';
            verdictIcon.innerHTML = '⚠️ <i class="bi bi-x-octagon-fill text-danger"></i>';
            verdictTitle.textContent = 'NON-ELIGIBLE / INCOMPLETE';
            verdictDesc.textContent = 'Entity falls below minimum relaxed qualification thresholds (DPIIT recognition or minimum technical prototype required).';
        }
    }

    // Render Batch Screening Table
    function renderBatchTable() {
        if (!GovData.startups || GovData.startups.length === 0) {
            batchTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No startup screening records found.</td></tr>';
            return;
        }
        batchTbody.innerHTML = GovData.startups.map(su => {
            const screening = getOrCreateScreening(su);
            const status = screening.overallStatus;
            const criteriaPassed = screening.results.filter(r => r.met).length;

            return `
                <tr>
                    <td class="fw-bold text-navy">${su.name}</td>
                    <td><span class="badge bg-light text-dark border">${su.sector}</span></td>
                    <td><small class="font-monospace text-primary">${su.dpiitNumber || 'None'}</small></td>
                    <td><small>${GovUtils.formatCurrency(su.turnover)}</small></td>
                    <td><small class="badge bg-light text-secondary border">${su.stage}</small></td>
                    <td><span class="fw-bold text-navy">${criteriaPassed} / 6</span></td>
                    <td><span class="badge-gov ${GovUtils.getBadgeClass(status)}">${status}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-inspect-screening" data-id="${su.id}">
                            <i class="bi bi-card-checklist me-1"></i> Audit
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-inspect-screening').forEach(btn => {
            btn?.addEventListener('click', () => {
                showAuditModal(btn.dataset.id);
            });
        });
    }

    function showAuditModal(id) {
        const su = GovData.startups.find(s => s.id === id);
        if (!su) return;
        const screening = getOrCreateScreening(su);
        
        let resultsHtml = screening.results.map(r => `
            <div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                <div><i class="bi ${r.met ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-2"></i><strong>${r.rule}</strong></div>
                <div class="small text-muted">${r.value} &bull; ${r.notes}</div>
            </div>
        `).join('');

        const html = `
            <div class="p-3">
                <div class="d-flex justify-content-between mb-3">
                    <h5 class="fw-bold">${su.name} <span class="badge bg-primary ms-2">${su.dpiitNumber || 'Unverified'}</span></h5>
                    <span class="badge ${screening && screening.overallStatus === 'ELIGIBLE' ? 'bg-success' : 'bg-danger'}">${screening ? screening.overallStatus : 'PENDING'}</span>
                </div>
                <div class="mb-4">
                    <h6 class="fw-bold border-bottom pb-2">Compliance Audit Trail</h6>
                    ${resultsHtml}
                </div>
                <div class="text-end">
                    <button class="btn btn-outline-primary btn-sm me-2" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print Report</button>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;
        GovUtils.openModal(`Audit Log: ${su.name}`, html);
    }

    // Event Listeners
    selScreeningSu?.addEventListener('change', (e) => {
        renderScreeningFor(e.target.value);
    });

    toggleGlobal?.addEventListener('change', (e) => {
        exemptionsEnabled = e.target.checked;
        renderRulesMatrix();
        renderScreeningFor(selScreeningSu.value);
        GovUtils.showToast(exemptionsEnabled ? 'Startup India relaxed exemption rules APPLIED.' : 'Strict legacy tender norms ENFORCED.', 'info');
    });

    document.getElementById('btn-export-screening')?.addEventListener('click', () => {
        if (!GovData.startups || GovData.startups.length === 0) {
            GovUtils.showToast('No data to export.', 'warning');
            return;
        }
        
        const headers = ['Entity Name', 'Sector', 'DPIIT Cert', 'Turnover', 'Prototype Stage', 'Final Status'];
        const rows = GovData.startups.map(su => {
            const screening = getOrCreateScreening(su);
            const status = screening.overallStatus;
            return [
                `"${su.name.replace(/"/g, '""')}"`,
                `"${su.sector}"`,
                `"${su.dpiitNumber || 'None'}"`,
                su.turnover,
                `"${su.stage}"`,
                `"${status}"`
            ];
        });
        
        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(',') + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "govcatalyst_screening_log.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        GovUtils.showToast('Eligibility Audit Log exported successfully.', 'success');
    });

    // Initialize
    async function initPage() {
        renderRulesMatrix();

        try {
            if (window.GovApi) {
                const refreshRes = await GovApi.getStartups();
                if (refreshRes.success && refreshRes.startups) {
                    GovData.startups = refreshRes.startups.map(s => ({
                        id: s.id,
                        name: s.company_name || 'Unnamed Startup',
                        description: s.pitch_summary || 'No description provided.',
                        sector: s.sector || 'General',
                        techStack: s.tech_tags || [],
                        matchTags: s.tech_tags ? s.tech_tags.map(t => t.toLowerCase()) : [],
                        pastPilots: s.past_pilots || 0,
                        turnover: s.past_turnover || 0,
                        stage: s.stage || 'Early',
                        dpiitNumber: s.dpiit_reg_number,
                        gemRegistered: s.gem_registered,
                        city: s.city || 'Not Specified',
                        founders: s.founders || 'Not Specified'
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to load initial startups:', e);
        }

        populateStartupSelector();
        if (GovData.startups.length > 0) {
            renderScreeningFor(GovData.startups[0].id);
        }
        renderBatchTable();
    }

    initPage();
});
