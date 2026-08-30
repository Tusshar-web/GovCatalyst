var GovData = window.GovData = {
    // --- MODULE 1: AUTH & REGISTRATION WORKFLOW ---
    pendingRegistrations: [],

    // --- MODULE 1: CHALLENGES ---
    challenges: [],

    challengeTemplates: [
        { id: 'T1', name: 'Digital Service Delivery', template: 'The department seeks a solution that can [DESCRIBE OUTCOME] within [TIMEFRAME], measured by [KPI METRIC], improving from a baseline of [BASELINE VALUE] to a target of [TARGET VALUE], serving [TARGET USERS] across [DEPLOYMENT SCOPE].' },
        { id: 'T2', name: 'Process Automation', template: 'The department requires automation of [PROCESS NAME] which currently takes [CURRENT TIME/EFFORT]. The solution should reduce processing time by [X%] while maintaining [QUALITY METRIC] above [THRESHOLD], tested over [SAMPLE SIZE] cases.' },
        { id: 'T3', name: 'Data Analytics & AI', template: 'The department needs an AI/ML-based solution for [USE CASE] that can achieve [ACCURACY/PERFORMANCE METRIC] of [TARGET VALUE] or above, processing [DATA VOLUME] within [TIME CONSTRAINT], validated against [BENCHMARK].' },
        { id: 'T4', name: 'Citizen Engagement', template: 'The department seeks a citizen-facing solution for [SERVICE AREA] that improves [CITIZEN METRIC] from [BASELINE] to [TARGET], reduces [FRICTION METRIC] by [X%], and serves [DAILY VOLUME] interactions within [DEPLOYMENT SCOPE].' }
    ],

    // --- MODULE 2: STARTUPS ---
    startups: [],

    // --- MODULE 3: ELIGIBILITY CRITERIA (STATUTORY RULES) ---
    eligibilityCriteria: [
        { id: 'EC-1', name: 'Annual Turnover', standardThreshold: '₹10 Crore minimum', relaxedThreshold: '₹25 Lakh minimum (Startup India)', description: 'Minimum annual turnover requirement for vendor qualification', exemptionApplicable: true },
        { id: 'EC-2', name: 'Years of Operation', standardThreshold: '5+ years', relaxedThreshold: '1+ year with working prototype', description: 'Minimum years of business operation', exemptionApplicable: true },
        { id: 'EC-3', name: 'DPIIT Recognition', standardThreshold: 'Not Required', relaxedThreshold: 'Mandatory — valid DPIIT certificate', description: 'Recognition under Startup India initiative', exemptionApplicable: false },
        { id: 'EC-4', name: 'Prototype / MVP Readiness', standardThreshold: 'Not Applicable', relaxedThreshold: 'Working prototype or MVP demo mandatory', description: 'Demonstration of functional product/prototype', exemptionApplicable: false },
        { id: 'EC-5', name: 'Team Credentials', standardThreshold: 'Certified professionals required', relaxedThreshold: 'Technical co-founder with domain expertise', description: 'Key team qualifications and experience', exemptionApplicable: true },
        { id: 'EC-6', name: 'Past Government Projects', standardThreshold: '3+ govt contracts completed', relaxedThreshold: '1 pilot or industry reference letter', description: 'Prior experience with government/enterprise clients', exemptionApplicable: true }
    ],
    startupScreenings: [],

    // --- MODULE 4: EVALUATION ---
    evaluators: [],
    evaluationRubric: [
        { category: 'Technical Feasibility', weight: 25, maxScore: 10, description: 'Technical and operational feasibility within government infrastructure constraints' },
        { category: 'Innovation & Novelty', weight: 20, maxScore: 10, description: 'Novelty of approach, technology differentiation, and creative problem solving' },
        { category: 'Alignment with Outcomes', weight: 25, maxScore: 10, description: 'Direct alignment with departmental problem statement and measurable baseline targets' },
        { category: 'Cost Effectiveness', weight: 15, maxScore: 10, description: 'Value for money, total cost of ownership, and budget efficiency' },
        { category: 'Scalability & Replication', weight: 15, maxScore: 10, description: 'Ability to scale across multiple departments, 36 districts, and state agencies' }
    ],
    evaluationScores: [],

    // --- MODULE 5: PILOTS ---
    pilots: [],

    // --- MODULE 6: MILESTONES ---
    milestones: [],
    agreementClauses: [
        { id: 'CL-1', category: 'IP Ownership', text: 'All intellectual property developed during the pilot shall remain with the startup. The Government retains a perpetual, non-exclusive license to use the solution for government purposes.' },
        { id: 'CL-2', category: 'Data Rights', text: 'Government data used during the pilot remains government property. The startup shall not retain, copy, or use government data beyond the pilot scope without written approval.' },
        { id: 'CL-3', category: 'Cybersecurity', text: 'The startup must comply with CERT-In guidelines and pass a security assessment before deployment. All data must be encrypted at rest (AES-256) and in transit (TLS 1.3).' },
        { id: 'CL-4', category: 'Liability & Indemnity', text: 'The startup shall indemnify the Government against any losses arising from system failures, data breaches, or regulatory non-compliance during the pilot period.' },
        { id: 'CL-5', category: 'Termination', text: 'Either party may terminate the pilot with 14 days written notice. All government data must be returned and securely deleted (NIST 800-88) within 7 days of termination.' },
        { id: 'CL-6', category: 'Confidentiality', text: 'Both parties shall maintain strict confidentiality of all shared information for a period of 3 years beyond pilot completion, subject to RTI Act provisions.' }
    ],

    // --- MODULE 7: KPI READINGS ---
    kpiReadings: [],

    // --- MODULE 8: PAYMENTS (MOCK DATA RETAINED AS PAYMENT BACKEND IS PENDING) ---
    payments: [
        { id: 'PAY-001', milestoneId: 'MS-001', pilotId: 'PLT-001', amount: 100000, status: 'Released', requestDate: '2026-06-13', approvalDate: '2026-06-14', releaseDate: '2026-06-16', escrowHeld: false },
        { id: 'PAY-002', milestoneId: 'MS-002', pilotId: 'PLT-001', amount: 150000, status: 'Released', requestDate: '2026-06-26', approvalDate: '2026-06-27', releaseDate: '2026-06-30', escrowHeld: false },
        { id: 'PAY-003', milestoneId: 'MS-003', pilotId: 'PLT-001', amount: 150000, status: 'Released', requestDate: '2026-07-19', approvalDate: '2026-07-20', releaseDate: '2026-07-22', escrowHeld: false },
        { id: 'PAY-004', milestoneId: 'MS-004', pilotId: 'PLT-001', amount: 100000, status: 'Released', requestDate: '2026-07-27', approvalDate: '2026-07-28', releaseDate: '2026-07-30', escrowHeld: false },
        { id: 'PAY-005', milestoneId: 'MS-005', pilotId: 'PLT-002', amount: 200000, status: 'Released', requestDate: '2026-08-15', approvalDate: '2026-08-16', releaseDate: '2026-08-18', escrowHeld: false },
        { id: 'PAY-006', milestoneId: 'MS-006', pilotId: 'PLT-002', amount: 200000, status: 'In Escrow', requestDate: null, approvalDate: null, releaseDate: null, escrowHeld: true },
        { id: 'PAY-007', milestoneId: 'MS-007', pilotId: 'PLT-002', amount: 200000, status: 'Pending', requestDate: null, approvalDate: null, releaseDate: null, escrowHeld: true },
        { id: 'PAY-008', milestoneId: 'MS-008', pilotId: 'PLT-002', amount: 100000, status: 'Pending', requestDate: null, approvalDate: null, releaseDate: null, escrowHeld: true }
    ],

    // --- MODULE 9: SCALE-UP ---
    scaleupDecisions: [],

    // --- MODULE 10: ADMIN & GOVERNANCE ---
    users: [],
    roleDefinitions: [
        { role: 'Super Admin', permissions: ['All modules', 'User management', 'System configuration', 'Audit access', 'Role assignment'], description: 'Full system access — pre-configured, not available in registration', registerable: false },
        { role: 'Dept Admin', permissions: ['Challenge creation', 'Pilot management', 'Payment approval', 'Reports', 'User viewing'], description: 'Department-level administration and pilot oversight', registerable: true },
        { role: 'Evaluator', permissions: ['Evaluation scoring', 'Startup review', 'COI declaration', 'Report viewing'], description: 'Expert evaluation and scoring for startup proposals', registerable: true },
        { role: 'Startup', permissions: ['Profile management', 'Challenge application', 'Milestone submission', 'Evidence upload', 'Payment tracking'], description: 'Startup participant with self-service access', registerable: true },
        { role: 'Validator', permissions: ['Audit trail review', 'Sign-off workflow', 'Compliance verification', 'Financial audit'], description: 'Independent validation and audit oversight', registerable: true }
    ],
    auditTrail: [],
    validatorSignoffs: [],

    currentRole: 'dept_admin'
};


// ============================================
// SECTION 3: UTILITY FUNCTIONS
// ============================================
