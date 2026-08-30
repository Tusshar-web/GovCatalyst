/* =============================================
   GovCatalyst — Module 4: Expert Evaluation Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
    const evaluatorsList = document.getElementById('evaluators-list');
    const rubricTbody = document.getElementById('rubric-tbody');
    const rankingTbody = document.getElementById('ranking-tbody');
    const filterRankingChallenge = document.getElementById('filter-ranking-challenge');

    const cardScoringForm = document.getElementById('card-scoring-form');
    const btnToggleScoring = document.getElementById('btn-toggle-scoring');
    const btnCloseScoring = document.getElementById('btn-close-scoring');
    const btnCancelScoring = document.getElementById('btn-cancel-scoring');
    const formScorecard = document.getElementById('form-scorecard');

    const scoreChallenge = document.getElementById('score-challenge');
    const scoreStartup = document.getElementById('score-startup');
    const scoreEvaluator = document.getElementById('score-evaluator');
    const coiWarningBox = document.getElementById('coi-warning-box');
    const coiWarningText = document.getElementById('coi-warning-text');

    const rngInno = document.getElementById('rng-inno');
    const rngFeas = document.getElementById('rng-feas');
    const rngScal = document.getElementById('rng-scal');
    const rngCost = document.getElementById('rng-cost');
    const rngAlign = document.getElementById('rng-align');
    const valAlign = document.getElementById('val-align');

    const valInno = document.getElementById('val-inno');
    const valFeas = document.getElementById('val-feas');
    const valScal = document.getElementById('val-scal');
    const valCost = document.getElementById('val-cost');
    const liveTotalScore = document.getElementById('live-total-score');

    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    const normRole = currentUser && currentUser.role ? currentUser.role.toLowerCase().replace(/[\s-]/g, '_') : '';

    // Only evaluator and super_admin can submit scoring
    if (currentUser && normRole !== 'evaluator' && normRole !== 'super_admin') {
        if (btnToggleScoring) btnToggleScoring.style.display = 'none';
    }

    // Toggle scoring form
    function toggleScoring(show) {
        if (currentUser && normRole !== 'evaluator' && normRole !== 'super_admin') {
            GovUtils.showToast('Access Denied: Only certified Evaluators can submit scores.', 'error');
            return;
        }
        cardScoringForm.style.display = show ? 'block' : 'none';
        if (show) cardScoringForm.scrollIntoView({ behavior: 'smooth' });
    }

    btnToggleScoring?.addEventListener('click', () => toggleScoring(cardScoringForm.style.display === 'none'));
    btnCloseScoring?.addEventListener('click', () => toggleScoring(false));
    btnCancelScoring?.addEventListener('click', () => toggleScoring(false));

    // Render Evaluator Chips
    function renderEvaluators() {
        evaluatorsList.innerHTML = GovData.evaluators.map(ev => `
            <div class="evaluator-chip">
                <div class="emblem-circle" style="width: 32px; height: 32px; font-size: 11px;">${ev.name.split(' ').map(n=>n[0]).join('').substring(0,2)}</div>
                <div class="flex-grow-1">
                    <div class="fw-bold text-navy small">${ev.name}</div>
                    <small class="text-muted d-block" style="font-size: 11px;">${ev.expertise} &bull; ${ev.department}</small>
                </div>
                ${ev.coiDeclared 
                    ? `<span class="badge bg-warning text-dark" title="${ev.coiDetails}"><i class="bi bi-exclamation-triangle"></i> COI</span>`
                    : '<span class="badge bg-success"><i class="bi bi-shield-check"></i> Clear</span>'}
            </div>
        `).join('');
    }

    // Render Rubric Table
    async function renderRubric() {
        let rubricData = GovData.evaluationRubric;
        let cId = (filterRankingChallenge && filterRankingChallenge.value) || (scoreChallenge && scoreChallenge.value);

        try {
            if (window.GovApi && cId) {
                const res = await GovApi.getEvaluationCriteria(cId);
                if (res.success && res.criteria) {
                    rubricData = res.criteria;
                }
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }

        rubricTbody.innerHTML = rubricData.map(r => `
            <tr>
                <td class="fw-bold text-navy">${r.category || r.name || 'Criterion'}</td>
                <td class="text-center"><span class="badge bg-primary">${r.weight}%</span></td>
                <td class="text-center fw-semibold">${r.maxScore !== undefined ? r.maxScore : 10} pts</td>
                <td><small class="text-muted">${r.description}</small></td>
            </tr>
        `).join('');
    }

    // Populate Selects in Form
    async function populateFormSelects() {
        let challenges = GovData.challenges;
        let startups = GovData.startups;
        let evaluators = GovData.evaluators;

        try {
            if (window.GovApi) {
                const resC = await GovApi.getChallenges();
                if (resC.success && resC.challenges) challenges = resC.challenges;

                const resS = await GovApi.getStartups();
                if (resS.success && resS.startups) startups = resS.startups;

                const resE = await GovApi.getEvaluators();
                if (resE.success && resE.users) evaluators = resE.users;
            }
        } catch (e) {
            console.warn('Backend unavailable, using local data:', e.message);
        }

        // Also update local GovData just so functions like checkCoi can find them
        GovData.evaluators = evaluators;
        GovData.startups = startups;

        scoreChallenge.innerHTML = challenges.map(c => `
            <option value="${c.id}">[${c.id.substring(0,8) || c.id}] ${c.title}</option>
        `).join('');

        scoreStartup.innerHTML = startups.map(s => `
            <option value="${s.id}">[${s.id.substring(0,8) || s.id}] ${s.company_name || s.name}</option>
        `).join('');

        scoreEvaluator.innerHTML = evaluators.map(e => `
            <option value="${e.id}">${e.name} (${e.department_name || e.department || 'Evaluator'})</option>
        `).join('');

        filterRankingChallenge.innerHTML = '<option value="">All Challenges</option>' + 
            challenges.map(c => `<option value="${c.id}">${c.id.substring(0,8) || c.id} - ${c.title}</option>`).join('');
    }

    // Check Conflict of Interest on change
    function checkCoi() {
        const evId = scoreEvaluator.value;
        const suId = scoreStartup.value;
        const ev = GovData.evaluators.find(e => e.id === evId);
        
        if (ev && ev.coiDeclared && ev.coiDetails.includes(suId)) {
            coiWarningBox.style.display = 'block';
            coiWarningText.textContent = `${ev.name} has declared conflict of interest regarding this entity: "${ev.coiDetails}". Scorecard will be flagged.`;
        } else {
            coiWarningBox.style.display = 'none';
        }
    }

    scoreEvaluator?.addEventListener('change', checkCoi);
    scoreStartup?.addEventListener('change', checkCoi);
    scoreChallenge?.addEventListener('change', () => {
        checkCoi();
        renderRubric();
    });

    // Compute live weighted score
    function updateLiveScore() {
        const inno = parseInt(rngInno.value, 10);
        const feas = parseInt(rngFeas.value, 10);
        const scal = parseInt(rngScal.value, 10);
        const cost = parseInt(rngCost.value, 10);

        valInno.textContent = `${inno} / 10`;
        valFeas.textContent = `${feas} / 10`;
        valScal.textContent = `${scal} / 10`;
        valCost.textContent = `${cost} / 10`;

        const total = (inno / 10 * 30) + (feas / 10 * 25) + (scal / 10 * 25) + (cost / 10 * 20);
        liveTotalScore.textContent = `${total.toFixed(1)} / 100`;
    }

    [rngInno, rngFeas, rngScal, rngCost].forEach(slider => {
        slider?.addEventListener('input', updateLiveScore);
    });

    // Form Submission
    formScorecard?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const suId = scoreStartup.value;
        const chId = scoreChallenge.value;
        const evId = scoreEvaluator.value;

        const assignmentId = `assign_${evId}_${suId}`; // Mock ID as fallback

        const newScore = {
            startupId: suId,
            challengeId: chId,
            evaluatorId: evId,
            assignmentId: assignmentId,
            scores: [
                { criterionId: 'innovation', score: parseInt(rngInno.value, 10) },
                { criterionId: 'feasibility', score: parseInt(rngFeas.value, 10) },
                { criterionId: 'scalability', score: parseInt(rngScal.value, 10) },
                { criterionId: 'cost', score: parseInt(rngCost.value, 10) }
            ],
            comments: document.getElementById('inp-score-comments').value.trim() || 'Evaluated per standard GFR rubric.'
        };

        try {
            if (window.GovApi) {
                const scoresForApi = newScore.scores.map(s => ({
                    ...s,
                    comments: newScore.comments,
                    justification: ''
                }));
                await GovApi.submitEvaluationScores({ 
                    assignmentId, 
                    scores: scoresForApi,
                    challengeId: chId,
                    startupId: suId,
                    evaluatorId: evId
                });
            }
        } catch (err) {
            console.error('Backend submit failed:', err.message);
            GovUtils.showToast('Failed to submit scores. Please try again.', 'error');
            return; // Abort local update if backend fails
        }

        // Remove previous if exists from same evaluator for same pair
        GovData.evaluationScores = GovData.evaluationScores.filter(
            s => !(s.startupId === suId && s.challengeId === chId && s.evaluatorId === evId)
        );
        GovData.evaluationScores.unshift(newScore);

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: GovData.evaluators.find(e => e.id === evId)?.name || 'Evaluator',
            role: 'Evaluator',
            action: 'Score Submission',
            module: 'Evaluation',
            detail: `Submitted scorecard for ${suId} on ${chId} with weighted score ${GovUtils.calcWeightedScore({
                innovation: parseInt(rngInno.value, 10),
                feasibility: parseInt(rngFeas.value, 10),
                scalability: parseInt(rngScal.value, 10),
                cost: parseInt(rngCost.value, 10)
            })}`
        });

        formScorecard.reset();
        updateLiveScore();
        toggleScoring(false);
        renderRankingTable();
        GovUtils.showToast('Expert scorecard successfully recorded and leaderboard updated!', 'success');
    });

    // Render Ranking Table
    function renderRankingTable() {
        const filterCh = filterRankingChallenge.value;

        // Group scores by (startupId, challengeId) to compute average if multiple evaluators
        const grouped = {};
        GovData.evaluationScores.forEach(es => {
            if (filterCh && es.challengeId !== filterCh) return;
            const key = `${es.startupId}_${es.challengeId}`;
            if (!grouped[key]) {
                grouped[key] = {
                    startupId: es.startupId,
                    challengeId: es.challengeId,
                    innoTotal: 0,
                    feasTotal: 0,
                    scalTotal: 0,
                    costTotal: 0,
                    count: 0,
                    evaluators: [],
                    latestComment: es.comments
                };
            }
            const getScore = (critId) => {
                if (Array.isArray(es.scores)) {
                    const s = es.scores.find(x => x.criterionId === critId);
                    return s ? s.score : 0;
                }
                return es.scores[critId] || 0;
            };

            grouped[key].innoTotal += getScore('innovation');
            grouped[key].feasTotal += getScore('feasibility');
            grouped[key].scalTotal += getScore('scalability');
            grouped[key].costTotal += getScore('cost');
            grouped[key].count += 1;
            const ev = GovData.evaluators.find(e => e.id === es.evaluatorId);
            if (ev) grouped[key].evaluators.push(ev.name);
        });

        const list = Object.values(grouped).map(g => {
            const avgInno = g.innoTotal / g.count;
            const avgFeas = g.feasTotal / g.count;
            const avgScal = g.scalTotal / g.count;
            const avgCost = g.costTotal / g.count;
            const weighted = (avgInno / 10 * 30) + (avgFeas / 10 * 25) + (avgScal / 10 * 25) + (avgCost / 10 * 20);

            return {
                ...g,
                avgInno: Math.round(avgInno * 10) / 10,
                avgFeas: Math.round(avgFeas * 10) / 10,
                avgScal: Math.round(avgScal * 10) / 10,
                avgCost: Math.round(avgCost * 10) / 10,
                weightedScore: Math.round(weighted * 10) / 10
            };
        });

        list.sort((a, b) => b.weightedScore - a.weightedScore);

        if (list.length === 0) {
            rankingTbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No evaluation scores found for the selected challenge.</td></tr>`;
            return;
        }

        rankingTbody.innerHTML = list.map((item, idx) => {
            const rank = idx + 1;
            const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-other'));
            const su = GovData.startups.find(s => s.id === item.startupId) || { name: item.startupId, sector: '' };
            const ch = GovData.challenges.find(c => c.id === item.challengeId) || { title: item.challengeId };

            return `
                <tr>
                    <td class="text-center"><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td>
                        <span class="fw-bold text-navy">${su.name}</span>
                        <small class="text-muted d-block">${su.sector}</small>
                    </td>
                    <td>
                        <span class="small fw-semibold text-dark">${ch.title}</span>
                        <small class="text-muted font-monospace d-block">${item.challengeId}</small>
                    </td>
                    <td class="text-center fw-medium">${item.avgInno}/10</td>
                    <td class="text-center fw-medium">${item.avgFeas}/10</td>
                    <td class="text-center fw-medium">${item.avgScal}/10</td>
                    <td class="text-center fw-medium">${item.avgCost}/10</td>
                    <td class="text-center">
                        <span class="badge ${item.weightedScore >= 80 ? 'bg-success' : 'bg-primary'} p-2 font-monospace" style="font-size: 13px;">
                            ${item.weightedScore} / 100
                        </span>
                    </td>
                    <td><small class="text-muted">${item.evaluators.join(', ')}</small></td>
                    <td class="text-end">
                        <a href="pilot-design.html?startupId=${item.startupId}&challengeId=${item.challengeId}" class="btn btn-sm btn-gov">
                            <i class="bi bi-flask me-1"></i> Structure Pilot
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    filterRankingChallenge?.addEventListener('change', () => {
        renderRankingTable();
        renderRubric();
    });

    // Initial render
    renderEvaluators();
    await populateFormSelects();
    await renderRubric();
    updateLiveScore();
    renderRankingTable();
});
