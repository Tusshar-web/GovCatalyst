/* =============================================
   GovCatalyst — Module 8: Payment Release Logic
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const selPilot = document.getElementById('sel-payment-pilot');
    const paymentsTbody = document.getElementById('payments-tbody');
    const paymentsCountBadge = document.getElementById('payments-count-badge');

    const statTotalBudget = document.getElementById('stat-total-budget');
    const statReleasedAmount = document.getElementById('stat-released-amount');
    const statEscrowAmount = document.getElementById('stat-escrow-amount');
    const statPendingAmount = document.getElementById('stat-pending-amount');

    // Populate Pilot selector
    function populatePilots() {
        selPilot.innerHTML = '<option value="">All Pilot Contracts</option>' +
            GovData.pilots.map(p => `
                <option value="${p.id}">[${p.id}] ${p.name}</option>
            `).join('');
    }

    const currentUser = (window.GovApi && GovApi.getCurrentUser()) || (window.GovPageAuth && GovPageAuth.getUser()) || null;
    const normRole = currentUser && currentUser.role ? currentUser.role.toLowerCase().replace(/[\s-]/g, '_') : '';
    const canManagePayments = normRole === 'dept_admin' || normRole === 'super_admin';

    // Render Stats and Table
    function renderPayments() {
        const filterP = selPilot.value;

        const filtered = GovData.payments.filter(p => !filterP || p.pilotId === filterP);

        // Compute Financial Totals
        const total = filtered.reduce((sum, p) => sum + p.amount, 0);
        const released = filtered.filter(p => p.status === 'Released').reduce((sum, p) => sum + p.amount, 0);
        const escrow = filtered.filter(p => p.status === 'In Escrow').reduce((sum, p) => sum + p.amount, 0);
        const pending = filtered.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0);

        statTotalBudget.textContent = GovUtils.formatCurrency(total);
        statReleasedAmount.textContent = GovUtils.formatCurrency(released);
        statEscrowAmount.textContent = GovUtils.formatCurrency(escrow);
        statPendingAmount.textContent = GovUtils.formatCurrency(pending);
        paymentsCountBadge.textContent = `${filtered.length} Tranches`;

        if (filtered.length === 0) {
            paymentsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No payment tranches recorded for this selection.</td></tr>`;
            return;
        }

        paymentsTbody.innerHTML = filtered.map(pay => {
            const milestone = GovData.milestones.find(m => m.id === pay.milestoneId) || { name: pay.milestoneId };
            const pilot = GovData.pilots.find(p => p.id === pay.pilotId) || { name: pay.pilotId };

            let actionBtn = '';
            if (pay.status === 'In Escrow') {
                actionBtn = canManagePayments
                    ? `<button class="btn btn-sm btn-success btn-release-escrow" data-id="${pay.id}"><i class="bi bi-unlock-fill me-1"></i> Release Funds</button>`
                    : `<span class="badge bg-warning text-dark"><i class="bi bi-lock-fill me-1"></i> In Escrow</span>`;
            } else if (pay.status === 'Pending') {
                actionBtn = canManagePayments
                    ? `<button class="btn btn-sm btn-outline-warning btn-request-escrow" data-id="${pay.id}"><i class="bi bi-lock me-1"></i> Lock in Escrow</button>`
                    : `<span class="badge bg-secondary">Pending Escrow</span>`;
            } else {
                actionBtn = `<span class="text-success small fw-bold"><i class="bi bi-check2-all me-1"></i> Disbursed</span>`;
            }

            return `
                <tr>
                    <td><span class="badge bg-secondary font-monospace">${pay.id}</span></td>
                    <td>
                        <span class="fw-semibold text-navy">${milestone.name}</span>
                        <small class="text-muted font-monospace d-block">${pay.milestoneId}</small>
                    </td>
                    <td>
                        <span class="small fw-medium">${pilot.name}</span>
                        <small class="text-muted font-monospace d-block">${pay.pilotId}</small>
                    </td>
                    <td><strong class="text-navy fs-6">${GovUtils.formatCurrency(pay.amount)}</strong></td>
                    <td>
                        ${pay.escrowHeld 
                            ? '<span class="escrow-locked-badge"><i class="bi bi-lock-fill"></i> In Escrow</span>' 
                            : '<span class="escrow-released-badge"><i class="bi bi-check-circle-fill"></i> Released</span>'}
                    </td>
                    <td><small class="text-muted">${GovUtils.formatDate(pay.approvalDate)}</small></td>
                    <td><small class="text-muted">${GovUtils.formatDate(pay.releaseDate)}</small></td>
                    <td class="text-end">${actionBtn}</td>
                </tr>
            `;
        }).join('');

        // Bind Release & Escrow buttons
        document.querySelectorAll('.btn-release-escrow').forEach(btn => {
            btn?.addEventListener('click', () => {
                const payId = btn.dataset.id;
                releasePayment(payId);
            });
        });

        document.querySelectorAll('.btn-request-escrow').forEach(btn => {
            btn?.addEventListener('click', () => {
                const payId = btn.dataset.id;
                lockInEscrow(payId);
            });
        });
    }

    function releasePayment(payId) {
        const pay = GovData.payments.find(p => p.id === payId);
        if (!pay) return;

        pay.status = 'Released';
        pay.escrowHeld = false;
        pay.approvalDate = new Date().toISOString().split('T')[0];
        pay.releaseDate = new Date().toISOString().split('T')[0];

        // Also mark corresponding milestone completed if not already
        const m = GovData.milestones.find(item => item.id === pay.milestoneId);
        if (m) {
            m.status = 'Completed';
            m.completedDate = new Date().toISOString().split('T')[0];
        }

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: 'Shri Rajesh Verma',
            role: 'Dept Admin',
            action: 'Payment Released',
            module: 'Payments',
            detail: `Authorized smart escrow release of ${GovUtils.formatCurrency(pay.amount)} for tranche ${pay.id} (${pay.milestoneId})`
        });

        renderPayments();
        GovUtils.showToast(`Tranche ${pay.id} of ${GovUtils.formatCurrency(pay.amount)} released to startup account!`, 'success');
    }

    function lockInEscrow(payId) {
        const pay = GovData.payments.find(p => p.id === payId);
        if (!pay) return;

        pay.status = 'In Escrow';
        pay.escrowHeld = true;
        pay.requestDate = new Date().toISOString().split('T')[0];

        GovData.auditTrail.unshift({
            id: GovData.auditTrail.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: 'Shri Rajesh Verma',
            role: 'Dept Admin',
            action: 'Escrow Locked',
            module: 'Payments',
            detail: `Allocated and locked ${GovUtils.formatCurrency(pay.amount)} in escrow for tranche ${pay.id}`
        });

        renderPayments();
        GovUtils.showToast(`Tranche ${pay.id} is now securely LOCKED in Escrow.`, 'info');
    }

    selPilot?.addEventListener('change', renderPayments);

    // Initial render
    populatePilots();
    renderPayments();
});
