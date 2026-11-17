-- Existing tickets keep their data and receive the general category.
ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('technical', 'billing', 'account', 'other'));
