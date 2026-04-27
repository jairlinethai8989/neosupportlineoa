-- Add abbreviation column to hospitals table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hospitals' AND column_name='abbreviation') THEN
        ALTER TABLE hospitals ADD COLUMN abbreviation TEXT;
    END IF;
END $$;

-- Optional: Update existing records with a default abbreviation based on their name
UPDATE hospitals SET abbreviation = UPPER(LEFT(name, 10)) WHERE abbreviation IS NULL;
