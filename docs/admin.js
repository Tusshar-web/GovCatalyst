/* =============================================
   GovCatalyst — Module 10: Admin & Governance Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const cardAddUser = document.getElementById('card-add-user');
    const btnToggleAddUser = document.getElementById('btn-toggle-add-user');
    const btnCloseAddUser = document.getElementById('btn-close-add-user');
    const btnCancelAddUser = document.getElementById('btn-cancel-add-user');
    const formAddUser = document.getElementById('form-add-user');

    const auditTbody = document.getElementById('audit-tbody');
    const signoffsTbody = document.getElementById('signoffs-tbody');
    const usersTbody = document.getElementById('users-tbody');
    const rbacCardsGrid = document.getElementById('rbac-cards-grid');

    const auditCount = document.getElementById('audit-count');
    const signoffsCount = document.getElementById('signoffs-count');
    const usersCount = document.getElementById('users-count');

    const searchAudit = document.getElementById('search-audit');
    const filterAuditModule = document.getElementById('filter-audit-module');

    // RBAC check on Admin Page UI
    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    const normRole = currentUser && currentUser.role ? currentUser.role.toLowerCase().replace(/[\s-]/g, '_') : '';

    // Only super_admin can manually provision users or manage the pending verification queue
    if (normRole !== 'super_admin') {
        if (btnToggleAddUser) btnToggleAddUser.style.display = 'none';
        const pendingTabBtn = document.querySelector('#admin-tabs [data-tab="tab-pending-users"]');
        if (pendingTabBtn) pendingTabBtn.parentElement.style.display = 'none';
    }

    // Default tab navigation for Validator
    if (normRole === 'validator') {
        const signoffsTabBtn = document.querySelector('#admin-tabs [data-tab="tab-signoffs"]');
        if (signoffsTabBtn) {
            setTimeout(() => signoffsTabBtn.click(), 50);
        }
    }

    // Tabs switching
    document.querySelectorAll('#admin-tabs .nav-link').forEach(btn => {
        btn?.addEventListener('click', () => {
            document.querySelectorAll('#admin-tabs .nav-link').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content-pane').forEach(p => p.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';

            if (tabId === 'tab-pending-users') {
                renderPendingRegistrations();
            }
        });
    });

    function toggleAddUser(show) {
        if (normRole !== 'super_admin') {
            GovUtils.showToast('Access Denied: Only Super Admin can provision system users.', 'error');
            return;
        }
        cardAddUser.style.display = show ? 'block' : 'none';
        if (show) cardAddUser.scrollIntoView({ behavior: 'smooth' });
    }

    btnToggleAddUser?.addEventListener('click', () => toggleAddUser(cardAddUser.style.display === 'none'));
    btnCloseAddUser?.addEventListener('click', () => toggleAddUser(false));
    btnCancelAddUser?.addEventListener('click', () => toggleAddUser(false));

    function getRoleBadgeClass(role) {
        switch(role) {
            case 'Super Admin': return 'role-badge-superadmin';
            case 'Dept Admin': return 'role-badge-deptadmin';
            case 'Evaluator': return 'role-badge-evaluator';
            case 'Startup': return 'role-badge-startup';
            case 'Validator': return 'role-badge-validator';
            default: return 'bg-secondary';
        }
    }

    
    const pendingUsersTbody = document.getElementById('pending-users-tbody');
    const badgePendingCount = document.getElementById('badge-pending-count');

    // Render Pending Government Registrations
    async function renderPendingRegistrations() {
        if (!pendingUsersTbody) return;

        let pendingList = GovData.pendingRegistrations || [];

        // Fetch live pending users from PostgreSQL backend
        if (window.GovApi) {
            try {
                const res = await GovApi.getPendingUsers();
                if (res && res.success && Array.isArray(res.users) && res.users.length > 0) {
                    const dbUsers = res.users.map(u => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role === 'dept_admin' ? 'Dept Admin' : u.role === 'evaluator' ? 'Evaluator' : u.role === 'validator' ? 'Validator' : u.role,
                        department: u.department_name || 'Government Department',
                        designation: u.designation || 'Official',
                        appliedAt: u.created_at ? new Date(u.created_at).toISOString().slice(0, 16).replace('T', ' ') : 'Just now',
                        status: u.account_status === 'approved' ? 'approved_awaiting_otp' : 'pending',
                        otpCode: u.otp_code || null
                    }));
                    pendingList = dbUsers;
                }
            } catch (e) {
                console.log('Pending users live fetch fallback to local:', e.message);
            }
        }

        const activePending = pendingList.filter(r => r.status === 'pending');
        if (badgePendingCount) badgePendingCount.textContent = activePending.length;

        if (pendingList.length === 0) {
            pendingUsersTbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No registration requests in queue.</td></tr>';
            return;
        }

        pendingUsersTbody.innerHTML = pendingList.map(r => {
            let statusBadge = '';
            let actionBtns = '';

            if (r.status === 'pending') {
                statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i> Pending Verification</span>';
                actionBtns = `
                    <button class="btn btn-sm btn-success btn-approve-user me-1" data-id="${r.id}" title="Verify credentials and send 6-digit activation OTP">
                        <i class="bi bi-check-circle me-1"></i> Approve & Send OTP
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-reject-user" data-id="${r.id}">
                        <i class="bi bi-x-circle me-1"></i> Reject
                    </button>
                `;
            } else if (r.status === 'approved_awaiting_otp') {
                statusBadge = `<span class="badge bg-info text-dark" title="OTP Code: ${r.otpCode}"><i class="bi bi-envelope-check me-1"></i> Approved (OTP: ${r.otpCode})</span>`;
                actionBtns = `<span class="text-info small fw-bold"><i class="bi bi-hourglass-split me-1"></i> Awaiting User OTP</span>`;
            } else if (r.status === 'rejected') {
                statusBadge = '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i> Rejected</span>';
                actionBtns = '<span class="text-muted small">Declined</span>';
            } else if (r.status === 'active') {
                statusBadge = '<span class="badge bg-success"><i class="bi bi-shield-check me-1"></i> Active</span>';
                actionBtns = '<span class="text-success small fw-bold">Provisioned</span>';
            }

            return `
                <tr>
                    <td><small class="font-monospace text-navy fw-bold">${r.id.length > 12 ? r.id.slice(0,8) + '...' : r.id}</small></td>
                    <td><span class="fw-semibold text-dark">${r.name}</span></td>
                    <td><small class="font-monospace text-primary">${r.email}</small></td>
                    <td><span class="badge ${getRoleBadgeClass(r.role)} font-monospace">${r.role}</span></td>
                    <td><small class="text-secondary">${r.department}</small></td>
                    <td><small class="text-muted">${r.designation}</small></td>
                    <td><small class="text-muted">${r.appliedAt}</small></td>
                    <td>${statusBadge}</td>
                    <td class="text-end">${actionBtns}</td>
                </tr>
            `;
        }).join('');

        // Attach event handlers
        document.querySelectorAll('.btn-approve-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const req = pendingList.find(r => r.id === id);
                if (req) {
                    let otpCode = null;

                    // Call backend first to get the real OTP
                    if (window.GovApi) {
                        try {
                            const res = await GovApi.approveUser(id);
                            console.log('✅ Super Admin approved user in PostgreSQL backend:', res);
                            otpCode = res.otp || res.mock_otp || null;
                        } catch (err) {
                            console.log('Live approval fallback:', err.message);
                            GovUtils.showToast(`Approval failed: ${err.message || 'Make sure your local backend server is running.'}`, 'error');
                            return;
                        }
                    }

                    if (!otpCode) {
                        GovUtils.showToast('Backend did not return an OTP code.', 'error');
                        return;
                    }

                    req.status = 'approved_awaiting_otp';
                    req.otpCode = otpCode;

                    GovData.auditTrail.unshift({
                        id: GovData.auditTrail.length + 1,
                        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                        user: 'MSInS Super Admin',
                        role: 'Super Admin',
                        action: 'REGISTRATION_APPROVED_OTP_DISPATCHED',
                        module: 'Auth',
                        detail: `Approved ${req.name} (${req.role}). 6-digit OTP (${otpCode}) dispatched to ${req.email}.`
                    });

                    GovUtils.showToast(`Official approved! 6-digit activation OTP (${otpCode}) dispatched to ${req.email}`, 'success');
                    renderPendingRegistrations();
                    renderAuditTrail();
                }
            });
        });

        document.querySelectorAll('.btn-reject-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const req = GovData.pendingRegistrations.find(r => r.id === id);
                if (req) {
                    req.status = 'rejected';

                    if (window.GovApi) {
                        GovApi.rejectUser(id).then(res => {
                            console.log('✅ Super Admin rejected user in PostgreSQL backend:', res);
                        }).catch(err => {
                            console.log('Live rejection fallback:', err.message);
                        });
                    }

                    GovData.auditTrail.unshift({
                        id: GovData.auditTrail.length + 1,
                        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                        user: 'MSInS Super Admin',
                        role: 'Super Admin',
                        action: 'REGISTRATION_REJECTED',
                        module: 'Auth',
                        detail: `Registration request for ${req.name} (${req.email}) was rejected.`
                    });

                    GovUtils.showToast(`Registration request for ${req.name} declined.`, 'warning');
                    renderPendingRegistrations();
                    renderAuditTrail();
                }
            });
        });
    }

    // Render Audit Trail
    function renderAuditTrail() {
        const search = searchAudit.value.toLowerCase();
        const mod = filterAuditModule.value;

        const filtered = GovData.auditTrail.filter(log => {
            const matchSearch = log.user.toLowerCase().includes(search) ||
                                log.action.toLowerCase().includes(search) ||
                                log.detail.toLowerCase().includes(search);
            const matchMod = !mod || log.module === mod;
            return matchSearch && matchMod;
        });

        auditCount.textContent = filtered.length;

        if (filtered.length === 0) {
            auditTbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No audit logs found matching criteria.</td></tr>`;
            return;
        }

        auditTbody.innerHTML = filtered.map(log => `
            <tr>
                <td><small class="text-muted font-monospace">${log.id}</small></td>
                <td><small class="font-monospace text-navy">${log.timestamp}</small></td>
                <td><span class="fw-semibold text-dark">${log.user}</span></td>
                <td><span class="badge ${getRoleBadgeClass(log.role)} font-monospace" style="font-size: 11px;">${log.role}</span></td>
                <td><strong class="text-navy">${log.action}</strong></td>
                <td><span class="badge bg-light text-dark border">${log.module}</span></td>
                <td><small class="text-secondary">${log.detail}</small></td>
            </tr>
        `).join('');
    }

    // Render Validator Sign-Offs
    function renderSignoffs() {
        signoffsCount.textContent = GovData.validatorSignoffs.length;

        if (GovData.validatorSignoffs.length === 0) {
            signoffsTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No pending validator sign-offs found.</td></tr>';
            return;
        }

        signoffsTbody.innerHTML = GovData.validatorSignoffs.map(so => {
            const isSigned = so.status === 'Signed Off';
            const actionBtn = isSigned 
                ? '<span class="text-success small fw-bold"><i class="bi bi-shield-fill-check me-1"></i> Sealed & Audited</span>'
                : `<button class="btn btn-sm btn-success btn-execute-signoff" data-id="${so.id}"><i class="bi bi-pen-fill me-1"></i> Authorize & Sign Off</button>`;

            return `
                <tr>
                    <td><span class="badge bg-secondary font-monospace">${so.id}</span></td>
                    <td><strong class="text-navy">${so.pilotId}</strong></td>
                    <td>
                        <span class="fw-medium">${so.validatorName}</span>
                        <small class="text-muted d-block font-monospace">${so.validatorId}</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">${so.module}</span></td>
                    <td>
                        <span class="badge-gov ${GovUtils.getBadgeClass(so.status)}">${so.status}</span>
                    </td>
                    <td><small class="text-muted">${GovUtils.formatDate(so.signoffDate)}</small></td>
                    <td><small class="text-secondary">${so.comments || 'Pending audit review'}</small></td>
                    <td class="text-end">${actionBtn}</td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-execute-signoff').forEach(btn => {
            btn?.addEventListener('click', () => {
                const soId = btn.dataset.id;
                executeSignoff(soId);
            });
        });
    }

    function executeSignoff(soId) {
        const so = GovData.validatorSignoffs.find(s => s.id === soId);
        if (!so) return;

        so.status = 'Signed Off';
        so.signoffDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
        so.comments = 'Independent validator audit completed. Compliance certified under GFR Rule 194.';

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: so.validatorName,
            role: 'Validator',
            action: 'Sign-off Approved',
            module: 'Admin',
            detail: `Independent validator verification certified for ${so.id} on ${so.pilotId} (${so.module})`
        });

        renderSignoffs();
        renderAuditTrail();
        GovUtils.showToast(`Audit Sign-Off ${so.id} successfully recorded!`, 'success');
    }

    // Render Users
    function renderUsers() {
        usersCount.textContent = GovData.users.length;

        if (GovData.users.length === 0) {
            usersTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No active user records found. Use the + Provision New User button to create users.</td></tr>';
            return;
        }

        usersTbody.innerHTML = GovData.users.map(u => `
            <tr>
                <td><span class="badge bg-secondary font-monospace">${u.id}</span></td>
                <td><span class="fw-bold text-navy">${u.name}</span></td>
                <td><span class="badge ${getRoleBadgeClass(u.role)}">${u.role}</span></td>
                <td><small class="font-monospace text-primary">${u.email}</small></td>
                <td><small>${u.department}</small></td>
                <td><small class="text-muted">${u.lastLogin}</small></td>
                <td class="text-center"><span class="badge bg-success">${u.status}</span></td>
            </tr>
        `).join('');
    }

    // Render RBAC Matrix
    function renderRbac() {
        rbacCardsGrid.innerHTML = GovData.roleDefinitions.map(r => `
            <div class="col-md-6 col-lg-4">
                <div class="gov-card h-100 mb-0">
                    <div class="gov-card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold text-navy mb-0">${r.role}</h6>
                            <span class="badge ${getRoleBadgeClass(r.role)}">${r.role}</span>
                        </div>
                        <p class="small text-secondary mb-3">${r.description}</p>
                        
                        <div class="mb-2">
                            <small class="fw-bold text-dark d-block mb-1">Permitted Privileges:</small>
                            <div>${r.permissions.map(p => `<span class="permission-pill">${p}</span>`).join('')}</div>
                        </div>

                        <div class="pt-2 border-top text-muted small">
                            Registration: <strong>${r.registerable ? '✅ Open' : '🔒 Pre-Seeded Single Account'}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Add User Form submit
    formAddUser?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('inp-u-name').value.trim();
        const email = document.getElementById('inp-u-email').value.trim();
        const role = document.getElementById('inp-u-role').value;
        const dept = document.getElementById('inp-u-dept').value.trim();

        const newUser = {
            id: `USR-00${GovData.users.length + 1}`,
            name: name,
            role: role,
            email: email,
            department: dept,
            lastLogin: 'Just now',
            status: 'Active'
        };

        GovData.users.unshift(newUser);

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: 'Shri Anil Kumar (Super Admin)',
            role: 'Super Admin',
            action: 'User Provisioned',
            module: 'Admin',
            detail: `Provisioned new ${role} account for ${name} (${email})`
        });

        formAddUser.reset();
        toggleAddUser(false);
        renderUsers();
        renderAuditTrail();
        GovUtils.showToast(`User ${name} provisioned as ${role}!`, 'success');
    });

    searchAudit?.addEventListener('input', renderAuditTrail);
    filterAuditModule?.addEventListener('change', renderAuditTrail);

    // Initial render
    renderAuditTrail();
    renderPendingRegistrations();
    renderSignoffs();
    renderUsers();
    renderRbac();
});
