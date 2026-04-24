-- Add new fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS line_username TEXT;

-- Optional: Populate existing data if possible
-- UPDATE customers SET full_name = display_name WHERE full_name IS NULL;
