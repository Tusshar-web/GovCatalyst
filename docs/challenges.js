/* =============================================
   GovCatalyst — Module 1: Challenge Builder Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
    let challengesList = GovData.challenges;
    const tableBody = document.getElementById('challenges-tbody');
    const cardForm = document.getElementById('card-form');
    const btnToggle = document.getElementById('btn-toggle-builder');
    const btnClose = document.getElementById('btn-close-form');
    const btnCancel = document.getElementById('btn-cancel-form');
    const selTemplate = document.getElementById('sel-template');
    const btnAiRewrite = document.getElementById('btn-ai-rewrite');
    const formChallenge = document.getElementById('form-challenge');
    const searchInput = document.getElementById('search-challenge');
    const filterStatus = document.getElementById('filter-status');

    // Role-based Access Control (RBAC) on UI
    const currentUser = window.GovApi ? GovApi.getCurrentUser() : null;
    if (currentUser && btnToggle) {
        // Only allow dept_admin (and super_admin) to create challenges
        if (currentUser.role !== 'dept_admin' && currentUser.role !== 'super_admin') {
            btnToggle.style.display = 'none';
        }
    }

    // Toggle Form visibility
    function toggleForm(show) {
        cardForm.style.display = show ? 'block' : 'none';
        if (show) {
            cardForm.scrollIntoView({ behavior: 'smooth' });
        }
    }

    btnToggle?.addEventListener('click', () => toggleForm(cardForm.style.display === 'none'));
    btnClose?.addEventListener('click', () => toggleForm(false));
    btnCancel?.addEventListener('click', () => toggleForm(false));

    // Template selection auto-fill
    selTemplate?.addEventListener('change', (e) => {
        const tId = e.target.value;
        const template = GovData.challengeTemplates.find(t => t.id === tId);
        if (template) {
            const desc = document.getElementById('inp-desc');
            if (!desc.value.trim()) {
                desc.value = template.template;
            }
            GovUtils.showToast(`Applied ${template.name} template structure.`, 'info');
        }
    });

    // AI Rewrite Integration (Google Gemini)
    btnAiRewrite?.addEventListener('click', async () => {
        const title = document.getElementById('inp-title').value.trim();
        const desc = document.getElementById('inp-desc').value.trim();
        const dept = document.getElementById('inp-dept').value || 'Department';
        const cat = document.getElementById('inp-cat').value;
        const budget = document.getElementById('inp-turnover').value;

        if (!desc) {
            GovUtils.showToast('Please enter a problem description first to rewrite.', 'warning');
            return;
        }

        btnAiRewrite.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Formulating Measurable Outcomes...';
        btnAiRewrite.disabled = true;

        if (window.GovApi) {
            try {
                const res = await GovApi.generateChallengeDraft({
                    raw_problem_input: desc,
                    sector: cat,
                    budget_ceiling: budget
                });

                if (res.success && res.ai_draft) {
                    document.getElementById('inp-outcome').value = res.ai_draft.outcome_statement;
                    if (res.ai_draft.tech_tags && res.ai_draft.tech_tags.length > 0) {
                        document.getElementById('inp-tech-tags').value = res.ai_draft.tech_tags.join(', ');
                    }
                    GovUtils.showToast('Problem rewritten into GFR Rule 194 compliant outcome statement!', 'success');
                }
            } catch (err) {
                console.error('AI Draft Error:', err);
                GovUtils.showToast('Failed to generate AI draft. Please try again.', 'error');
            }
        } else {
            GovUtils.showToast('GovApi is not available. Ensure you are running the backend server.', 'error');
        }

        btnAiRewrite.innerHTML = '<i class="bi bi-robot me-1"></i> AI Rewrite → Convert to Measurable Outcome Statement (GFR 194)';
        btnAiRewrite.disabled = false;
    });

    // Form submission
    formChallenge?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newChallenge = {
            id: `CH-00${GovData.challenges.length + 1}`,
            title: document.getElementById('inp-title').value.trim(),
            department: document.getElementById('inp-dept').value,
            category: document.getElementById('inp-cat').value,
            description: document.getElementById('inp-desc').value.trim(),
            outcomeStatement: document.getElementById('inp-outcome').value.trim(),
            status: 'Draft',
            createdDate: new Date().toISOString().split('T')[0],
            templateUsed: document.getElementById('sel-template').value || 'Custom'
        };

        GovData.challenges.unshift(newChallenge);

        // Dispatch live to PostgreSQL backend if available
        if (window.GovApi) {
            try {
                const res = await GovApi.createChallenge({
                    title: newChallenge.title,
                    problem_statement: newChallenge.description,
                    outcome_objective: newChallenge.outcomeStatement,
                    sector: newChallenge.category,
                    department: newChallenge.department
                });
                console.log('✅ Challenge saved in PostgreSQL backend:', res);
                await renderTable();
            } catch (err) {
                console.log('Challenge backend sync fallback:', err.message);
            }
        }

        // Log in audit trail
        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: 'Shri Rajesh Verma',
            role: 'Dept Admin',
            action: 'Challenge Created',
            module: 'Challenges',
            detail: `Created new challenge draft ${newChallenge.id}: ${newChallenge.title}`
        });

        formChallenge.reset();
        toggleForm(false);
        await renderTable();
        updateStats();
        GovUtils.showToast(`Challenge ${newChallenge.id} created successfully as Draft!`, 'success');
    });

    // Render Table
    async function renderTable() {
        const search = searchInput.value.toLowerCase();
        const status = filterStatus.value;

        try {
            if (window.GovApi) {
                const res = await GovApi.getChallenges();
                if (res.success && res.challenges) challengesList = res.challenges;
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
            challengesList = GovData.challenges;
        }

        const filtered = challengesList.filter(c => {
            const matchesSearch = c.title.toLowerCase().includes(search) ||
                c.department.toLowerCase().includes(search) ||
                c.id.toLowerCase().includes(search);
            const matchesStatus = !status || c.status === status;
            return matchesSearch && matchesStatus;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No challenge statements found matching criteria.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map(c => `
            <tr>
                <td><span class="badge bg-secondary font-monospace">${c.id}</span></td>
                <td>
                    <div class="fw-semibold text-navy">${c.title}</div>
                    <small class="text-muted text-truncate d-block" style="max-width: 320px;">${c.outcomeStatement || c.description}</small>
                </td>
                <td><small class="fw-medium">${c.department}</small></td>
                <td><span class="badge bg-light text-dark border">${c.category}</span></td>
                <td><span class="badge-gov ${GovUtils.getBadgeClass(c.status)}">${c.status}</span></td>
                <td><small class="text-muted">${GovUtils.formatDate(c.createdDate)}</small></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-view" data-id="${c.id}" title="View Details">
                            <i class="bi bi-eye"></i> View
                        </button>
                        ${c.status === 'Draft' && currentUser && (currentUser.role === 'dept_admin' || currentUser.role === 'super_admin') ? `
                            <button class="btn btn-outline-success btn-publish" data-id="${c.id}" title="Publish to Startups">
                                <i class="bi bi-send"></i> Publish
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        // Bind Action buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn?.addEventListener('click', () => viewChallengeDetails(btn.dataset.id));
        });

        document.querySelectorAll('.btn-publish').forEach(btn => {
            btn?.addEventListener('click', () => publishChallenge(btn.dataset.id));
        });
    }

    function viewChallengeDetails(id) {
        const c = challengesList.find(ch => ch.id === id);
        if (!c) return;

        const content = `
            <div class="space-y-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <span class="badge bg-primary me-2">${c.id}</span>
                        <span class="badge bg-secondary">${c.category}</span>
                    </div>
                    <span class="badge-gov ${GovUtils.getBadgeClass(c.status)}">${c.status}</span>
                </div>
                <h5 class="fw-bold text-navy mb-1">${c.title}</h5>
                <p class="text-muted mb-3"><i class="bi bi-building me-1"></i> ${c.department}</p>
                
                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Problem Context / Pain Point:</label>
                    <div class="p-3 bg-light rounded border text-secondary small">${c.description}</div>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-navy small text-uppercase"><i class="bi bi-bullseye me-1"></i> Outcome-Based Target Statement (GFR 194):</label>
                    <div class="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded text-dark small font-monospace">${c.outcomeStatement}</div>
                </div>

                <div class="row g-2 pt-2 border-top text-muted small">
                    <div class="col-6"><strong>Created On:</strong> ${GovUtils.formatDate(c.createdDate)}</div>
                    <div class="col-6"><strong>Template Reference:</strong> ${c.templateUsed || 'Custom Form'}</div>
                </div>

                <div class="mt-4 pt-3 border-top text-end">
                    ${c.status === 'Draft' && currentUser && (currentUser.role === 'dept_admin' || currentUser.role === 'super_admin') ? `
                        <button class="btn btn-success btn-sm me-2" onclick="document.querySelector('.btn-publish[data-id=\\'${c.id}\\']')?.click(); GovUtils.closeModal();">
                            <i class="bi bi-send me-1"></i> Publish Statement
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`Challenge Specification — ${c.id}`, content);
    }

    async function publishChallenge(id) {
        let c = GovData.challenges.find(ch => ch.id === id);
        if (!c) c = challengesList.find(ch => ch.id === id);

        if (c) {
            c.status = 'Published'; // Optimistic GovData mutation

            try {
                if (window.GovApi) {
                    await GovApi.publishChallenge(id);
                }
            } catch (e) {
                console.warn('Backend unavailable, using local data:', e.message);
            }

            GovData.auditTrail.unshift({
                id: GovData.auditTrail.length + 1,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                user: 'Shri Rajesh Verma',
                role: 'Dept Admin',
                action: 'Challenge Published',
                module: 'Challenges',
                detail: `Published challenge ${c.id} to open innovation portal.`
            });
            await renderTable();
            updateStats();
            GovUtils.showToast(`Challenge ${c.id} is now PUBLISHED and open for startup discovery!`, 'success');
        }
    }

    function updateStats() {
        document.getElementById('cnt-total').textContent = challengesList.length;
        document.getElementById('cnt-published').textContent = challengesList.filter(c => c.status === 'Published').length;
        document.getElementById('cnt-matched').textContent = challengesList.filter(c => c.status === 'Matched').length;
        document.getElementById('cnt-draft').textContent = challengesList.filter(c => c.status === 'Draft').length;
    }

    searchInput?.addEventListener('input', async () => { await renderTable(); updateStats(); });
    filterStatus?.addEventListener('change', async () => { await renderTable(); updateStats(); });

    // Initial render
    await renderTable();
    updateStats();
});
