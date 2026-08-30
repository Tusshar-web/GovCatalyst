-- ================================================================
-- GovCatalyst — Pilot Module DB Migration (v2)
-- Uses gov_pilots as the table name to avoid conflict with existing
-- slim `pilots` table. All IDs are UUID for consistency.
-- Run once against PostgreSQL database: GovBridge
-- ================================================================

-- ── gov_pilots (full pilot design table) ───────────────────────
CREATE TABLE IF NOT EXISTS gov_pilots (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_code              VARCHAR(64)   UNIQUE NOT NULL,       -- e.g. PILOT-2026-4521
  name                    VARCHAR(255)  NOT NULL,
  problem_statement_text  TEXT          NOT NULL,
  department              VARCHAR(255)  NOT NULL,
  startup                 VARCHAR(255)  NOT NULL,
  startup_lead            VARCHAR(255)  NOT NULL,
  solution                VARCHAR(255)  NOT NULL,
  objective               TEXT          NOT NULL,
  baseline_objective      VARCHAR(255)  NOT NULL,
  target_objective        VARCHAR(255)  NOT NULL,
  min_acceptable_result   VARCHAR(255)  NOT NULL,
  success_condition       TEXT          NOT NULL,
  location                VARCHAR(255)  NOT NULL,
  start_date              DATE          NOT NULL,
  end_date                DATE          NOT NULL,
  duration_weeks          INTEGER       NOT NULL DEFAULT 8,
  users_count             INTEGER       NOT NULL DEFAULT 10,
  scope_included          JSONB         NOT NULL DEFAULT '[]',
  scope_excluded          JSONB         NOT NULL DEFAULT '[]',
  budget_allocated        NUMERIC(14,2) NOT NULL DEFAULT 0,
  budget_spent            NUMERIC(14,2) NOT NULL DEFAULT 0,
  pilot_owner             VARCHAR(255)  NOT NULL,
  status                  VARCHAR(64)   NOT NULL DEFAULT 'DRAFT',
  outcome                 VARCHAR(64)   NOT NULL DEFAULT 'PENDING',
  committee_decision      VARCHAR(64)   NOT NULL DEFAULT 'PENDING',
  committee_reason        TEXT,
  committee_recommendation TEXT,
  security_status         VARCHAR(64)   NOT NULL DEFAULT 'LOW RISK',
  cyber_checklist         JSONB         NOT NULL DEFAULT '[]',
  data_rules              JSONB         NOT NULL DEFAULT '{}',
  ip_rules                JSONB         NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── gov_pilot_kpis ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_kpis (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id             UUID          NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  kpi_code             VARCHAR(32)   NOT NULL,
  name                 VARCHAR(255)  NOT NULL,
  category             VARCHAR(64)   NOT NULL DEFAULT 'Efficiency',
  direction            VARCHAR(32)   NOT NULL DEFAULT 'LOWER_IS_BETTER'
                         CHECK (direction IN ('LOWER_IS_BETTER','HIGHER_IS_BETTER')),
  unit                 VARCHAR(32)   NOT NULL DEFAULT '',
  baseline             NUMERIC(12,2) NOT NULL,
  target               NUMERIC(12,2) NOT NULL,
  min_acceptable       NUMERIC(12,2) NOT NULL,
  current              NUMERIC(12,2) NOT NULL,
  improvement_percent  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  status               VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
  historical_telemetry JSONB         NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── gov_pilot_risks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_risks (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id    UUID         NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  risk_code   VARCHAR(32)  NOT NULL,
  category    VARCHAR(64)  NOT NULL
                CHECK (category IN ('Technical','Security','Financial','Operational','Legal','Data','Safety')),
  description TEXT         NOT NULL,
  probability VARCHAR(16)  NOT NULL DEFAULT 'Low'
                CHECK (probability IN ('Low','Medium','High')),
  impact      VARCHAR(16)  NOT NULL DEFAULT 'Low'
                CHECK (impact IN ('Low','Medium','High')),
  level       VARCHAR(16)  NOT NULL DEFAULT 'Low'
                CHECK (level IN ('Low','Medium','High','Critical')),
  mitigation  TEXT         NOT NULL,
  owner       VARCHAR(255) NOT NULL,
  status      VARCHAR(32)  NOT NULL DEFAULT 'Open'
                CHECK (status IN ('Open','Mitigated','Accepted','Closed')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── gov_pilot_issues ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_issues (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id    UUID         NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  issue_code  VARCHAR(32)  NOT NULL,
  reported_by VARCHAR(255) NOT NULL,
  category    VARCHAR(64)  NOT NULL DEFAULT 'Technical'
                CHECK (category IN ('Technical','Security','Operational','Data','User Experience')),
  description TEXT         NOT NULL,
  severity    VARCHAR(16)  NOT NULL DEFAULT 'Low'
                CHECK (severity IN ('Low','Medium','High','Critical')),
  assigned_to VARCHAR(255),
  resolution  TEXT,
  status      VARCHAR(32)  NOT NULL DEFAULT 'Open'
                CHECK (status IN ('Open','In Progress','Resolved','Closed')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── gov_pilot_feedbacks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_feedbacks (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id             UUID          NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  user_name            VARCHAR(255)  NOT NULL,
  user_role            VARCHAR(255)  NOT NULL DEFAULT 'Govt Engineer',
  ease_of_use          SMALLINT      NOT NULL CHECK (ease_of_use BETWEEN 1 AND 5),
  performance          SMALLINT      NOT NULL CHECK (performance BETWEEN 1 AND 5),
  reliability          SMALLINT      NOT NULL CHECK (reliability BETWEEN 1 AND 5),
  accuracy             SMALLINT      NOT NULL CHECK (accuracy BETWEEN 1 AND 5),
  overall_satisfaction NUMERIC(3,2)  NOT NULL CHECK (overall_satisfaction BETWEEN 1 AND 5),
  comments             TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── gov_pilot_evidences ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_evidences (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id            UUID         NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  evidence_code       VARCHAR(32)  NOT NULL,
  name                VARCHAR(255) NOT NULL,
  document_type       VARCHAR(64)  NOT NULL,
  file_url            VARCHAR(512),
  uploaded_by         VARCHAR(255) NOT NULL,
  upload_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  related_milestone   VARCHAR(64),
  verification_status VARCHAR(32)  NOT NULL DEFAULT 'Pending'
                        CHECK (verification_status IN ('Pending','Verified','Rejected')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── gov_pilot_audit_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_audit_logs (
  id         SERIAL       PRIMARY KEY,
  pilot_id   UUID,
  user_id    INTEGER,
  action     VARCHAR(255) NOT NULL,
  detail     TEXT,
  old_value  TEXT         NOT NULL DEFAULT 'N/A',
  new_value  TEXT         NOT NULL DEFAULT 'N/A',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_gov_pilot_audit_pid ON gov_pilot_audit_logs(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_kpis_pid  ON gov_pilot_kpis(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_risks_pid ON gov_pilot_risks(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_issues_pid ON gov_pilot_issues(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_fb_pid    ON gov_pilot_feedbacks(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_ev_pid    ON gov_pilot_evidences(pilot_id);
CREATE INDEX IF NOT EXISTS idx_gov_pilots_code     ON gov_pilots(pilot_code);
CREATE INDEX IF NOT EXISTS idx_gov_pilots_status   ON gov_pilots(status);

-- ── gov_pilot_milestones ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gov_pilot_milestones (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id        UUID         NOT NULL REFERENCES gov_pilots(id) ON DELETE CASCADE,
  milestone_code  VARCHAR(32)  NOT NULL,
  phase           INTEGER      NOT NULL DEFAULT 1,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NOT NULL,
  due_date        DATE         NOT NULL,
  completed_date  DATE,
  payment_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_linked  BOOLEAN      NOT NULL DEFAULT true,
  status          VARCHAR(32)  NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending','In Progress','Verified','Overdue')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gov_pilot_ms_pid ON gov_pilot_milestones(pilot_id);
