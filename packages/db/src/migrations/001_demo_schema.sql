CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  resource_url TEXT NOT NULL UNIQUE,
  network_raw TEXT,
  asset_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payto_attribution (
  id BIGSERIAL PRIMARY KEY,
  payto TEXT NOT NULL,
  seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('stable', 'shared', 'rotating', 'unknown')),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payto_attribution_payto_valid
  ON payto_attribution (payto, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS payment_event (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  payer TEXT NOT NULL,
  payto TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL,
  amount_decimal NUMERIC(38, 18) NOT NULL,
  seller_id TEXT REFERENCES sellers(id) ON DELETE SET NULL,
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  assertion_scope TEXT NOT NULL CHECK (assertion_scope IN ('payto', 'seller', 'resource')),
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  observed_at TIMESTAMPTZ NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_event_dedupe
  ON payment_event (chain, tx_hash, log_index);

CREATE INDEX IF NOT EXISTS idx_payment_event_chain_block
  ON payment_event (chain, block_number DESC);

CREATE INDEX IF NOT EXISTS idx_payment_event_observed_at
  ON payment_event (observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_event_seller_resource
  ON payment_event (seller_id, resource_id, observed_at DESC);
