/* =============================================
   GovCatalyst — Module 2: Startup Discovery Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('startups-grid');
    const searchInput = document.getElementById('search-su');
    const filterSector = document.getElementById('filter-sector');
    const filterStage = document.getElementById('filter-stage');
    const countSpan = document.getElementById('count-startups');
    const selMatchChallenge = document.getElementById('sel-match-challenge');
    const btnRunMatch = document.getElementById('btn-run-match');
    const matchResultsContainer = document.getElementById('match-results-container');
    const matchCardsGrid = document.getElementById('match-cards-grid');

    const cardRegForm = document.getElementById('card-reg-form');
    const btnToggleReg = document.getElementById('btn-toggle-reg');
    const btnCloseReg = document.getElementById('btn-close-reg');
    const btnCancelReg = document.getElementById('btn-cancel-reg');
    const formStartup = document.getElementById('form-startup');

    // Role-based Access Control (RBAC): Only guests or logged-in Startups can register startups
    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    if (currentUser && currentUser.role && btnToggleReg) {
        const normRole = currentUser.role.toLowerCase().replace(/[\s-]/g, '_');
        if (normRole !== 'startup') {
            btnToggleReg.style.display = 'none'; // Hide registration button from dept_admin, super_admin, evaluator, validator
        }
    }

    // Toggle Registration Form
    function toggleReg(show) {
        if (currentUser && currentUser.role) {
            const normRole = currentUser.role.toLowerCase().replace(/[\s-]/g, '_');
            if (normRole !== 'startup') {
                GovUtils.showToast(`Access Denied: You are signed in as ${currentUser.name} (${currentUser.role}). Government accounts cannot register startups.`, 'error');
                return;
            }
        }
        cardRegForm.style.display = show ? 'block' : 'none';
        if (show) cardRegForm.scrollIntoView({ behavior: 'smooth' });
    }

    btnToggleReg?.addEventListener('click', () => toggleReg(cardRegForm.style.display === 'none'));
    btnCloseReg?.addEventListener('click', () => toggleReg(false));
    btnCancelReg?.addEventListener('click', () => toggleReg(false));

    // Populate Match dropdown with open challenges
    async function populateMatchChallenges() {
        let challenges = GovData.challenges; // fallback default
        try {
            if (window.GovApi) {
                const res = await GovApi.getChallenges();
                if (res.success && res.challenges) challenges = res.challenges;
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }
        
        selMatchChallenge.innerHTML = '<option value="">-- Choose Challenge Statement --</option>' +
            challenges.map(c => `
                <option value="${c.id}">[${c.id}] ${c.title} (${c.category} - ${c.status})</option>
            `).join('');
    }

    // Run Intelligent Matching Engine
    btnRunMatch?.addEventListener('click', async () => {
        const cId = selMatchChallenge.value;
        if (!cId) {
            GovUtils.showToast('Please select a challenge statement to run matching.', 'warning');
            return;
        }

        let challengesList = GovData.challenges;
        try {
            if (window.GovApi) {
                const res = await GovApi.getChallenges();
                if (res.success && res.challenges) challengesList = res.challenges;
            }
        } catch (e) {
            console.warn('Backend unavailable:', e.message);
        }

        const challenge = challengesList.find(c => c.id == cId);
        if (!challenge) return;

        btnRunMatch.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Matching Capabilities & AI Scoring...';
        btnRunMatch.disabled = true;

        try {
            // Compute match scores based on sector similarity, category overlap, and tech tags
            const challengeWords = (challenge.title + ' ' + challenge.description + ' ' + challenge.category)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ' ')
                .split(' ')
                .filter(w => w.length > 2);

            const scoredStartups = await Promise.all(GovData.startups.map(async (su) => {
                let score = 30; // base score
                
                // Sector match
                if (su.sector.toLowerCase() === challenge.category.toLowerCase()) score += 35;
                else if ((su.sector === 'AI/ML' && challenge.category === 'Software') || (su.sector === 'IoT' && challenge.category === 'Hardware')) score += 20;

                // Tag overlap
                const tagOverlap = su.matchTags.filter(t => challengeWords.some(cw => cw.includes(t) || t.includes(cw))).length;
                score += tagOverlap * 12;

                // Past pilots boost
                score += Math.min(su.pastPilots * 4, 15);

                // DPIIT verified bonus
                if (su.dpiitNumber) score += 5;

                // GeM boost
                if (su.gemRegistered) score += 5;

                score = Math.min(Math.max(score, 25), 98); // Clamp between 25% and 98%

                let feedback = '';
                try {
                    if (window.GovApi) {
                        const res = await GovApi.applyToChallenge(challenge.id, { proposal_summary: su.description });
                        if (res.success) {
                            if (res.score) score = res.score;
                            if (res.evaluation && res.evaluation.feedback) {
                                feedback = res.evaluation.feedback;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Backend unavailable, using local data:', e.message);
                }

                return { startup: su, matchScore: score, feedback };
            }));

            scoredStartups.sort((a, b) => b.matchScore - a.matchScore);

            // Render Match Cards
            matchCardsGrid.innerHTML = scoredStartups.slice(0, 3).map((item, index) => {
                const su = item.startup;
                const scoreColor = item.matchScore >= 80 ? 'bg-success text-white' : (item.matchScore >= 60 ? 'bg-primary text-white' : 'bg-secondary text-white');
                const isTop = index === 0;

                return `
                    <div class="col-md-4">
                        <div class="card h-100 ${isTop ? 'match-card-winner shadow-sm' : 'border'}">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        ${isTop ? '<span class="badge bg-warning text-dark fw-bold mb-1"><i class="bi bi-star-fill me-1"></i> TOP MATCH</span>' : ''}
                                        <h6 class="fw-bold text-navy mb-0">${su.name}</h6>
                                        <small class="text-muted"><i class="bi bi-geo-alt"></i> ${su.city} · ${su.sector}</small>
                                    </div>
                                    <div class="match-badge-circle ${scoreColor}">
                                        <span>${item.matchScore}%</span>
                                        <small style="font-size: 8px;">MATCH</small>
                                    </div>
                                </div>
                                <p class="small text-secondary mb-2 text-truncate-2">${su.description}</p>
                                ${item.feedback ? `<div class="alert alert-info py-1 px-2 mb-2" style="font-size: 0.75rem;"><strong>AI Feedback:</strong> ${item.feedback}</div>` : ''}
                                <div class="mb-3">
                                    ${su.techStack.slice(0, 3).map(t => `<span class="tech-tag">${t}</span>`).join('')}
                                </div>
                                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                    <small class="text-muted">Pilots Done: <strong>${su.pastPilots}</strong></small>
                                    <button class="btn btn-sm btn-outline-primary btn-su-detail" data-id="${su.id}">
                                        View Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            matchResultsContainer.style.display = 'block';
            matchResultsContainer.scrollIntoView({ behavior: 'smooth' });
            GovUtils.showToast(`Found ${scoredStartups.length} matching startup candidates!`, 'success');

            // Re-bind modal buttons in match container
            matchCardsGrid.querySelectorAll('.btn-su-detail').forEach(btn => {
                btn?.addEventListener('click', () => viewStartupProfile(btn.dataset.id));
            });
            
        } catch (err) {
            console.error('Match engine error:', err);
            GovUtils.showToast('Error running match engine.', 'error');
        } finally {
            btnRunMatch.innerHTML = '<i class="bi bi-lightning-charge-fill me-1 text-warning"></i> Run Intelligent Match Engine';
            btnRunMatch.disabled = false;
        }
    });

    // Form Registration Submission
    formStartup?.addEventListener('submit', (e) => {
        e.preventDefault();

        // RBAC check
        if (currentUser && currentUser.role) {
            const normRole = currentUser.role.toLowerCase().replace(/[\s-]/g, '_');
            if (normRole !== 'startup') {
                GovUtils.showToast(`Access Denied: Government accounts (${currentUser.role}) cannot register startup profiles.`, 'error');
                return;
            }
        }

        const tags = document.getElementById('inp-su-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const newStartup = {
            id: `SU-00${GovData.startups.length + 1}`,
            name: document.getElementById('inp-su-name').value.trim(),
            sector: document.getElementById('inp-su-sector').value,
            stage: document.getElementById('inp-su-stage').value,
            techStack: tags.length ? tags : ['Software', 'Cloud'],
            pastPilots: parseInt(document.getElementById('inp-su-pilots').value || '0', 10),
            dpiitNumber: document.getElementById('inp-su-dpiit').value.trim() || 'DIPP-PENDING',
            gemRegistered: document.getElementById('inp-su-gem').value === 'true',
            founders: document.getElementById('inp-su-founders').value.trim() || 'Founder Team',
            city: document.getElementById('inp-su-city').value.trim(),
            description: document.getElementById('inp-su-desc').value.trim(),
            matchTags: tags.map(t => t.toLowerCase()),
            turnover: parseInt(document.getElementById('inp-su-turnover').value || '0', 10),
            teamSize: 10,
            founded: new Date().getFullYear().toString()
        };

        GovData.startups.unshift(newStartup);

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: newStartup.founders,
            role: 'Startup',
            action: 'Registration',
            module: 'Startups',
            detail: `Registered new startup profile ${newStartup.id}: ${newStartup.name} (${newStartup.sector})`
        });

        formStartup.reset();
        toggleReg(false);
        renderDirectory();
        populateMatchChallenges();
        GovUtils.showToast(`Startup ${newStartup.name} successfully registered!`, 'success');
    });

    // Render Directory Cards Grid
    function renderDirectory() {
        const search = searchInput.value.toLowerCase();
        const sector = filterSector.value;
        const stage = filterStage.value;

        const filtered = GovData.startups.filter(su => {
            const matchesSearch = su.name.toLowerCase().includes(search) ||
                                  su.city.toLowerCase().includes(search) ||
                                  su.description.toLowerCase().includes(search) ||
                                  su.techStack.some(t => t.toLowerCase().includes(search));
            const matchesSector = !sector || su.sector === sector;
            const matchesStage = !stage || su.stage === stage;
            return matchesSearch && matchesSector && matchesStage;
        });

        countSpan.textContent = filtered.length;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">No startups found matching your filter criteria.</div>`;
            return;
        }

        grid.innerHTML = filtered.map(su => `
            <div class="col-md-6 col-lg-4">
                <div class="startup-card p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge bg-secondary font-monospace">${su.id}</span>
                            <span class="badge-gov ${GovUtils.getBadgeClass(su.stage)} ms-1">${su.stage}</span>
                        </div>
                        <span class="badge bg-light text-dark border">${su.sector}</span>
                    </div>

                    <h5 class="fw-bold text-navy mb-1">${su.name}</h5>
                    <div class="small text-muted mb-2">
                        <i class="bi bi-geo-alt me-1"></i>${su.city} &bull; Est. ${su.founded || '2022'} &bull; Team: ${su.teamSize || '10'}
                    </div>

                    <p class="small text-secondary flex-grow-1 mb-3 text-truncate-3">${su.description}</p>

                    <!-- Badges -->
                    <div class="d-flex gap-2 mb-2">
                        ${su.dpiitNumber ? `<span class="dpiit-badge" title="${su.dpiitNumber}"><i class="bi bi-patch-check-fill text-primary"></i> DPIIT</span>` : ''}
                        ${su.gemRegistered ? `<span class="gem-badge"><i class="bi bi-cart-check-fill text-success"></i> GeM Listed</span>` : ''}
                        <span class="badge bg-light text-muted border"><i class="bi bi-flag me-1"></i>${su.pastPilots} Pilots</span>
                    </div>

                    <!-- Tech Tags -->
                    <div class="mb-3">
                        ${su.techStack.map(t => `<span class="tech-tag">${t}</span>`).join('')}
                    </div>

                    <div class="pt-2 border-top d-flex justify-content-between align-items-center">
                        <span class="small text-muted">Turnover: <strong>${GovUtils.formatCurrency(su.turnover)}</strong></span>
                        <button class="btn btn-sm btn-gov btn-su-detail" data-id="${su.id}">
                            View Profile
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Bind view profile buttons
        document.querySelectorAll('.btn-su-detail').forEach(btn => {
            btn?.addEventListener('click', () => viewStartupProfile(btn.dataset.id));
        });
    }

    function viewStartupProfile(id) {
        const su = GovData.startups.find(s => s.id === id);
        if (!su) return;

        const content = `
            <div class="space-y-3">
                <div class="d-flex justify-content-between align-items-start border-bottom pb-3">
                    <div>
                        <span class="badge bg-primary me-2">${su.id}</span>
                        <span class="badge bg-success">${su.stage} Stage</span>
                        <h4 class="fw-bold text-navy mt-1 mb-0">${su.name}</h4>
                        <small class="text-muted"><i class="bi bi-geo-alt"></i> ${su.city}, Maharashtra &bull; Founded: ${su.founded}</small>
                    </div>
                    <span class="badge-gov ${GovUtils.getBadgeClass(su.sector)}">${su.sector}</span>
                </div>

                <div class="row g-3 py-2">
                    <div class="col-md-6">
                        <div class="p-2 bg-light rounded border">
                            <small class="text-muted d-block">DPIIT Recognition</small>
                            <span class="fw-bold font-monospace text-primary">${su.dpiitNumber || 'Not Registered'}</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-2 bg-light rounded border">
                            <small class="text-muted d-block">GeM Portal Status</small>
                            <span class="fw-bold ${su.gemRegistered ? 'text-success' : 'text-secondary'}">
                                ${su.gemRegistered ? '✅ Registered on GeM' : '❌ Not on GeM'}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-2 bg-light rounded border">
                            <small class="text-muted d-block">Annual Turnover</small>
                            <span class="fw-bold">${GovUtils.formatCurrency(su.turnover)}</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-2 bg-light rounded border">
                            <small class="text-muted d-block">Prior Government Pilots</small>
                            <span class="fw-bold">${su.pastPilots} Completed Pilots</span>
                        </div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Founders & Leadership:</label>
                    <p class="text-muted small mb-0">${su.founders}</p>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Innovation & Product Description:</label>
                    <p class="text-secondary small mb-0">${su.description}</p>
                </div>

                <div class="mb-3">
                    <label class="fw-bold text-dark small text-uppercase">Core Technology Stack:</label>
                    <div>${su.techStack.map(t => `<span class="tech-tag">${t}</span>`).join('')}</div>
                </div>

                <div class="mt-4 pt-3 border-top text-end">
                    <a href="eligibility.html" class="btn btn-primary btn-sm me-2">
                        <i class="bi bi-shield-check me-1"></i> Screen for Eligibility
                    </a>
                    <button class="btn btn-secondary btn-sm" onclick="GovUtils.closeModal()">Close</button>
                </div>
            </div>
        `;

        GovUtils.openModal(`Innovator Profile — ${su.name}`, content);
    }

    searchInput?.addEventListener('input', renderDirectory);
    filterSector?.addEventListener('change', renderDirectory);
    filterStage?.addEventListener('change', renderDirectory);

    // Initial render
    populateMatchChallenges();
    renderDirectory();
});
