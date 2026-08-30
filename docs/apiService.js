window.GovApi = {
    getBaseUrl() {
        if (window.GOV_API_BASE) return window.GOV_API_BASE;
        const origin = window.location.origin || '';

        // If accessed from GitHub Pages, route to production Render API
        if (origin.includes('github.io')) {
            return 'https://govcatalyst.onrender.com';
        }

        // If accessed via file:// protocol during local testing, route to local server
        if (window.location.protocol === 'file:') {
            return 'http://localhost:5009';
        }

        // If local development on another port (e.g. 5500 Live Server)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (window.location.port === '5009') return '';
            return 'http://localhost:5009';
        }

        // Direct Render domain or same-origin deployment
        return '';
    },

    getToken() {
        return sessionStorage.getItem('gov_jwt_token') || sessionStorage.getItem('token') || localStorage.getItem('gov_jwt_token') || localStorage.getItem('token') || '';
    },

    setToken(token, user) {
        if (token) {
            sessionStorage.setItem('gov_jwt_token', token);
            sessionStorage.setItem('token', token);
            // Clean up any stale localStorage tokens
            localStorage.removeItem('gov_jwt_token');
            localStorage.removeItem('token');
        }
        if (user) {
            sessionStorage.setItem('gov_user', JSON.stringify(user));
            localStorage.removeItem('gov_user');
        }
    },

    clearToken() {
        sessionStorage.removeItem('gov_jwt_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('gov_user');
        localStorage.removeItem('gov_jwt_token');
        localStorage.removeItem('token');
        localStorage.removeItem('gov_user');
    },

    getCurrentUser() {
        try {
            const u = sessionStorage.getItem('gov_user') || localStorage.getItem('gov_user');
            return u ? JSON.parse(u) : null;
        } catch (e) {
            return null;
        }
    },

    async request(endpoint, options = {}) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const headers = options.headers || {};

        const token = this.getToken();
        if (token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const res = await fetch(url, { ...options, headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const err = new Error(data.message || `HTTP ${res.status}`);
                err.status = res.status;
                err.data = data;
                throw err;
            }
            return data;
        } catch (err) {
            console.warn(`GovApi request to ${endpoint} failed:`, err.message);
            throw err;
        }
    },

    // --- AUTH ENDPOINTS ---
    async login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    async register(userData) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async getMe() {
        return this.request('/api/auth/me');
    },

    async getPendingUsers() {
        return this.request('/api/auth/pending-users');
    },

    async approveUser(userId) {
        return this.request(`/api/auth/approve/${userId}`, { method: 'POST' });
    },

    async rejectUser(userId) {
        return this.request(`/api/auth/reject/${userId}`, { method: 'POST' });
    },

    async verifyOtp(email, otp) {
        return this.request('/api/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp })
        });
    },

    // --- CHALLENGES ENDPOINTS ---
    async getChallenges() {
        return this.request('/api/challenges');
    },

    async createChallenge(challengeData) {
        return this.request('/api/challenges', {
            method: 'POST',
            body: JSON.stringify(challengeData)
        });
    },

    async publishChallenge(id) {
        return this.request(`/api/challenges/${id}/publish`, {
            method: 'PATCH'
        });
    },

    async deleteChallenge(id) {
        return this.request(`/api/challenges/${id}`, {
            method: 'DELETE'
        });
    },

    async generateChallengeDraft(draftData) {
        return this.request('/api/challenges/ai-draft', {
            method: 'POST',
            body: JSON.stringify(draftData)
        });
    },

    // --- USERS & STARTUPS ENDPOINTS ---
    async getStartups() {
        return this.request('/api/startups');
    },

    async updateStartupProfile(profileData) {
        return this.request('/api/startups/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    },

    async getAiStartupMatches(challengeId) {
        return this.request('/api/startups/ai-match', {
            method: 'POST',
            body: { challenge_id: challengeId }
        });
    },

    async getEvaluators() {
        return this.request('/api/users?role=evaluator');
    },

    // --- APPLICATIONS ENDPOINTS ---
    async getApplications() {
        return this.request('/api/applications');
    },

    async submitApplication(appData) {
        return this.request('/api/applications', {
            method: 'POST',
            body: JSON.stringify(appData)
        });
    },

    // --- PILOT & M&E ENDPOINTS ---
    async getPilots() {
        return this.request('/api/pilots');
    },

    async getPilotById(pilotId) {
        return this.request(`/api/pilots/${pilotId}`);
    },

    async createPilot(pilotData) {
        return this.request('/api/pilots', {
            method: 'POST',
            body: JSON.stringify(pilotData)
        });
    },

    async ingestTelemetry(pilotId, kpiId, payload) {
        return this.request(`/api/pilots/${pilotId}/kpis/${kpiId}/telemetry`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getPilotAlerts(pilotId) {
        return this.request(`/api/pilots/${pilotId}/alerts`);
    },

    async getEvaluationReport(pilotId) {
        return this.request(`/api/pilots/${pilotId}/evaluation-report`);
    },

    async getRecommendations(pilotId) {
        return this.request(`/api/pilots/${pilotId}/recommendations`);
    },

    // --- CHALLENGE CRUD ---
    async getChallengeById(id) {
        return this.request(`/api/challenges/${id}`);
    },

    async getMyChallenges() {
        return this.request('/api/challenges/my');
    },

    async updateChallenge(id, data) {
        return this.request(`/api/challenges/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    async publishChallenge(id) {
        return this.request(`/api/challenges/${id}/publish`, { method: 'PATCH' });
    },

    // --- APPLICATION ENDPOINTS ---
    async applyToChallenge(challengeId, proposalData) {
        return this.request(`/api/applications/challenge/${challengeId}/apply`, {
            method: 'POST',
            body: JSON.stringify(proposalData)
        });
    },

    async getMyApplications() {
        return this.request('/api/applications/my');
    },

    async getApplicationsByChallenge(challengeId, params = '') {
        return this.request(`/api/applications/challenge/${challengeId}${params ? '?' + params : ''}`);
    },

    // --- EVALUATION ENDPOINTS ---
    async getEvaluationCriteria(challengeId) {
        return this.request(`/api/evaluations/criteria/${challengeId}`);
    },

    async seedEvaluationCriteria(challengeId) {
        return this.request(`/api/evaluations/criteria/seed/${challengeId}`, { method: 'POST' });
    },

    async createEvaluationCriterion(data) {
        return this.request('/api/evaluations/criteria', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async assignEvaluator(data) {
        return this.request('/api/evaluations/assign', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getMyEvalAssignments() {
        return this.request('/api/evaluations/assignments/my');
    },

    async submitEvaluationScores(data) {
        return this.request('/api/evaluations/scores/submit', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getEvalScoresByApplication(applicationId) {
        return this.request(`/api/evaluations/scores/${applicationId}`);
    },

    async finalizePanel(applicationId, summary) {
        return this.request(`/api/evaluations/panel/${applicationId}/finalize`, {
            method: 'POST',
            body: JSON.stringify({ panelSummary: summary })
        });
    },

    async getPanelDecision(applicationId) {
        return this.request(`/api/evaluations/panel/${applicationId}`);
    },

    async getEvaluationSummary(applicationId) {
        return this.request(`/api/evaluations/summary/${applicationId}`);
    },

    async submitAppeal(applicationId, reason, docs) {
        return this.request(`/api/evaluations/appeal/${applicationId}`, {
            method: 'POST',
            body: JSON.stringify({ appealReason: reason, supportingDocs: docs })
        });
    },

    async getPendingAppeals() {
        return this.request('/api/evaluations/appeals/pending');
    },

    // --- PILOT SUB-RESOURCE ENDPOINTS ---
    async getPilotKpis(pilotId) {
        return this.request(`/api/pilots/${pilotId}/kpis`);
    },

    async createPilotKpi(pilotId, data) {
        return this.request(`/api/pilots/${pilotId}/kpis`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateKpiReading(pilotId, kpiId, current) {
        return this.request(`/api/pilots/${pilotId}/kpis/${kpiId}`, {
            method: 'PATCH',
            body: JSON.stringify({ current })
        });
    },

    async getPilotRisks(pilotId) {
        return this.request(`/api/pilots/${pilotId}/risks`);
    },

    async createPilotRisk(pilotId, data) {
        return this.request(`/api/pilots/${pilotId}/risks`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getPilotIssues(pilotId) {
        return this.request(`/api/pilots/${pilotId}/issues`);
    },

    async createPilotIssue(pilotId, data) {
        return this.request(`/api/pilots/${pilotId}/issues`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getPilotFeedback(pilotId) {
        return this.request(`/api/pilots/${pilotId}/feedback`);
    },

    async submitPilotFeedback(pilotId, data) {
        return this.request(`/api/pilots/${pilotId}/feedback`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getPilotEvidences(pilotId) {
        return this.request(`/api/pilots/${pilotId}/evidences`);
    },

    async submitPilotEvidence(pilotId, data) {
        return this.request(`/api/pilots/${pilotId}/evidences`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async verifyPilotEvidence(pilotId, evidenceId, status) {
        return this.request(`/api/pilots/${pilotId}/evidences/${evidenceId}/verify`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async getPilotTelemetry(pilotId, limit = 100) {
        return this.request(`/api/pilots/${pilotId}/telemetry?limit=${limit}`);
    },

    async batchIngestTelemetry(pilotId, readings, sourceType) {
        return this.request(`/api/pilots/${pilotId}/telemetry/batch`, {
            method: 'POST',
            body: JSON.stringify({ readings, sourceType })
        });
    },

    async acknowledgePilotAlert(pilotId, alertId) {
        return this.request(`/api/pilots/${pilotId}/alerts/${alertId}/ack`, {
            method: 'PATCH'
        });
    },

    async updatePilotStatus(pilotId, targetStatus, reason) {
        return this.request(`/api/pilots/${pilotId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ targetStatus, reason })
        });
    },

    async evaluatePilot(pilotId, committeeDecision) {
        return this.request(`/api/pilots/${pilotId}/evaluate`, {
            method: 'POST',
            body: JSON.stringify({ committeeDecision })
        });
    },

    async getPilotReport(pilotId) {
        return this.request(`/api/pilots/${pilotId}/report`);
    },

    async getPilotAudit(pilotId) {
        return this.request(`/api/pilots/${pilotId}/audit`);
    },

    // --- FILE UPLOADS ---
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request('/api/upload/single', {
            method: 'POST',
            body: formData
        });
    },

    async uploadCsvTelemetry(csvFile) {
        const formData = new FormData();
        formData.append('file', csvFile);
        return this.request('/api/upload/csv-telemetry', {
            method: 'POST',
            body: formData
        });
    }
};


// ============================================================
// PAGE-LEVEL AUTHENTICATION GUARD (GovPageAuth)
// ============================================================
// Role-Based Access Control (RBAC) for frontend pages.
// Each page specifies which roles can access it.
// Unauthorized users see a branded access-denied overlay and are redirected.
// ============================================================

window.GovPageAuth = {

    // Page → Allowed Roles mapping
    pageRoles: {
        'index.html': ['*'],               // Public landing page
        'forgot-password.html': ['*'],            // Public
        'startups.html': ['*'],               // Public directory browsing (creation is role-gated)
        'challenges.html': ['*'],               // Public challenge browsing (creation is role-gated)
        'eligibility.html': ['startup', 'dept_admin', 'super_admin', 'evaluator'],
        'evaluation.html': ['evaluator', 'super_admin', 'dept_admin'],
        'pilot-design.html': ['dept_admin', 'startup', 'super_admin', 'validator'],
        'milestones.html': ['dept_admin', 'startup', 'super_admin', 'validator'],
        'performance.html': ['dept_admin', 'startup', 'super_admin', 'evaluator', 'validator'],
        'payments.html': ['dept_admin', 'super_admin', 'startup'],
        'scaleup.html': ['dept_admin', 'startup', 'super_admin'],
        'admin.html': ['super_admin', 'dept_admin', 'validator']
    },

    /**
     * Get currently logged-in user from sessionStorage (or legacy localStorage)
     */
    getUser() {
        try {
            const u = sessionStorage.getItem('gov_user') || localStorage.getItem('gov_user');
            return u ? JSON.parse(u) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Check if user has a valid JWT token
     */
    isLoggedIn() {
        const token = sessionStorage.getItem('gov_jwt_token') || sessionStorage.getItem('token') || localStorage.getItem('gov_jwt_token') || localStorage.getItem('token');
        const user = this.getUser();
        return !!(token && user);
    },

    /**
     * Get current page filename
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page;
    },

    /**
     * Check if user role is allowed on this page (handles normalized role matching)
     */
    isAuthorized(allowedRoles) {
        if (!allowedRoles || allowedRoles.includes('*')) return true;
        const user = this.getUser();
        if (!user || !user.role) return false;
        const normUserRole = user.role.toLowerCase().replace(/[\s-]/g, '_');
        const normAllowed = allowedRoles.map(r => r.toLowerCase().replace(/[\s-]/g, '_'));
        return normAllowed.includes(normUserRole);
    },

    /**
     * Show branded access-denied overlay matching authentic Maharashtra Gov portal design
     */
    showAccessDenied(reason) {
        document.body.style.backgroundColor = '#f8fafc';
        document.body.style.minHeight = '100vh';
        document.body.style.display = 'flex';
        document.body.style.flexDirection = 'column';

        document.body.innerHTML = `
            <!-- Tricolor Strip -->
            <div class="tricolor-strip">
                <span class="saffron"></span>
                <span class="white-s"></span>
                <span class="green-s"></span>
            </div>

            <!-- Clean Minimal Top Bar -->
            <div class="top-bar-clean">
                <div class="container d-flex justify-content-between align-items-center">
                    <a href="index.html" class="d-flex align-items-center gap-2 text-decoration-none">
                        <strong style="color: #ffffff; font-size: 17px; letter-spacing: -0.3px;">GovCatalyst</strong>
                    </a>
                    <div class="d-flex align-items-center gap-3">
                        <a href="index.html" class="btn btn-sm btn-outline-light d-flex align-items-center gap-1">
                            <i class="bi bi-house-door"></i> <span>Home</span>
                        </a>
                        <button class="top-tricolor-hamburger" id="gov-hamburger-toggle" onclick="GovNav && GovNav.toggleMegaMenu()" aria-label="Toggle Modules Menu" title="All Modules Menu (10)">
                            <span class="tri-bar bar-saffron"></span>
                            <span class="tri-bar bar-white"></span>
                            <span class="tri-bar bar-green"></span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Authorization Required Container -->
            <main class="container py-5 flex-grow-1 d-flex align-items-center justify-content-center" style="min-height: calc(100vh - 180px);">
                <div class="card shadow-sm border p-4 p-md-5 text-center" style="max-width: 520px; width: 100%; border-radius: 14px; background: #ffffff; border-color: #e2e8f0;">
                    <!-- Official Gov Shield Badge -->
                    <div class="d-inline-flex align-items-center justify-content-center mx-auto mb-3" style="width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; border: 2px solid #fde68a;">
                        <i class="bi bi-shield-lock-fill" style="font-size: 30px; color: #d97706;"></i>
                    </div>
                    
                    <h4 class="fw-bold mb-1" style="color: #0b192c;">Authorization Required</h4>
                    <div class="text-muted small mb-3">Maharashtra State Innovation Society &bull; GFR Rule 194</div>
                    
                    <p class="text-secondary small mb-4" style="line-height: 1.6;">
                        ${reason}
                    </p>

                    <div class="d-grid gap-2 mb-3">
                        <button type="button" class="btn btn-gov py-2 fw-semibold" onclick="window.location.href='index.html?login=1'">
                            <i class="bi bi-box-arrow-in-right me-1"></i> Sign In to Authorized Account
                        </button>
                        <button type="button" class="btn btn-outline-secondary py-2" onclick="window.history.back()">
                            <i class="bi bi-arrow-left me-1"></i> Return to Previous Page
                        </button>
                    </div>

                    <div class="pt-3 border-top text-muted" style="font-size: 11px;">
                        Official Innovation Procurement Mechanism &bull; Certified under IT Act Section 65B
                    </div>
                </div>
            </main>

            <!-- Footer -->
            <footer class="gov-footer" style="margin-top: auto;">
                <div class="container text-center" style="font-size: 13px;">
                    © 2026 Government of Maharashtra • IT Act 2000 Section 65B Certified Portal
                </div>
            </footer>
            <div class="tricolor-strip">
                <span class="saffron"></span>
                <span class="white-s"></span>
                <span class="green-s"></span>
            </div>
            <div class="toast-container-gov"></div>
        `;
    },

    /**
     * Show role badge in navbar for logged-in users
     */
    renderUserBadge() {
        const user = this.getUser();
        if (!user) return;

        const normRole = (user.role || '').toLowerCase().replace(/[\s-]/g, '_');

        const roleColors = {
            'super_admin': '#dc2626',
            'dept_admin': '#2563eb',
            'evaluator': '#7c3aed',
            'validator': '#059669',
            'startup': '#d97706'
        };

        const roleLabels = {
            'super_admin': '👑 Super Admin',
            'dept_admin': '🏛️ Dept Admin',
            'evaluator': '📋 Evaluator',
            'validator': '✅ Validator',
            'startup': '🚀 Startup'
        };

        // If top auth button exists on page (e.g. index.html), update it
        const topAuthBtn = document.getElementById('btn-top-auth');
        if (topAuthBtn) {
            topAuthBtn.innerHTML = `<i class="bi bi-person-fill-check"></i> <span>${user.name || user.email} (${roleLabels[normRole] || user.role})</span>`;
            topAuthBtn.onclick = () => GovPageAuth.showUserMenu();
        }

        // Avoid duplicate floating badges
        const oldBadge = document.getElementById('gov-user-badge');
        if (oldBadge) oldBadge.remove();

        const badge = document.createElement('div');
        badge.id = 'gov-user-badge';
        badge.style.cssText = `
            position: fixed; top: 12px; right: 16px; z-index: 9999;
            background: ${roleColors[normRole] || '#475569'}; color: white;
            padding: 8px 16px; border-radius: 20px; font-size: 13px;
            font-weight: 600; font-family: 'Inter', sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; gap: 8px;
        `;
        badge.innerHTML = `
            <span>${roleLabels[normRole] || user.role}</span>
            <span style="font-weight: 400; opacity: 0.85; font-size: 11px;">${user.name || user.email}</span>
            <button onclick="GovPageAuth.logout()" title="Sign Out" style="
                background: rgba(255,255,255,0.2); border: none; color: white;
                width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
                font-size: 11px; display: flex; align-items: center; justify-content: center;
                margin-left: 4px;
            ">✕</button>
        `;
        document.body.appendChild(badge);
    },

    showUserMenu() {
        const user = this.getUser();
        if (!user) return;
        if (confirm(`Signed in as: ${user.name || user.email}\nRole: ${user.role}\n\nWould you like to sign out?`)) {
            this.logout();
        }
    },

    /**
     * Logout: clear tokens and redirect
     */
    logout() {
        sessionStorage.removeItem('gov_jwt_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('gov_user');
        localStorage.removeItem('gov_jwt_token');
        localStorage.removeItem('token');
        localStorage.removeItem('gov_user');
        window.location.href = 'index.html';
    },

    /**
     * Main entry point: call this on every protected page.
     * Usage: GovPageAuth.require() or GovPageAuth.require(['super_admin', 'dept_admin'])
     */
    require(allowedRoles) {
        const page = this.getCurrentPage();

        // Auto-detect roles from pageRoles map if not specified
        if (!allowedRoles) {
            allowedRoles = this.pageRoles[page] || null;
        }

        // Public pages — no auth needed
        if (!allowedRoles || allowedRoles.includes('*')) {
            if (this.isLoggedIn()) this.renderUserBadge();
            return true;
        }

        // Not logged in
        if (!this.isLoggedIn()) {
            this.showAccessDenied(
                'You must be signed in with an authorized government account to access this module. Please return to the home page and sign in.'
            );
            return false;
        }

        // Logged in but wrong role
        if (!this.isAuthorized(allowedRoles)) {
            const user = this.getUser();
            this.showAccessDenied(
                `Your role <strong>${user.role}</strong> does not have permission to access this module. Required: <strong>${allowedRoles.join(', ')}</strong>.`
            );
            return false;
        }

        // Authorized — show user badge
        this.renderUserBadge();
        return true;
    }
};

// Auto-guard on DOMContentLoaded for all pages except index.html
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === '1' && window.GovAuth) {
        setTimeout(() => GovAuth.openAuthModal('login'), 200);
    }
    const page = GovPageAuth.getCurrentPage();
    if (page !== 'index.html' && page !== 'forgot-password.html' && page !== '') {
        GovPageAuth.require();
    } else if (GovPageAuth.isLoggedIn()) {
        GovPageAuth.renderUserBadge();
    }
});
