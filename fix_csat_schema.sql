-- Phase 1: Fix CSAT Score vs Rating Mismatch
-- Goal: Unify 'rating' into 'score' and setup backward compatibility triggers.

-- 1. Migrate legacy data: Copy existing ratings into the canonical score column if score is missing
UPDATE csat_surveys 
SET score = rating 
WHERE score IS NULL AND rating IS NOT NULL;

-- 2. Create trigger function to keep rating and score synchronized
-- This ensures that if any legacy code writes to 'rating', 'score' gets updated,
-- and if new code writes to 'score', 'rating' gets updated (to avoid breaking unknown legacy consumers).
CREATE OR REPLACE FUNCTION sync_csat_score() 
RETURNS TRIGGER AS $$
BEGIN
  -- If new code writes score, copy to rating
  IF NEW.score IS NOT NULL THEN
    NEW.rating = NEW.score;
  -- If legacy code writes rating, copy to score
  ELSIF NEW.rating IS NOT NULL THEN
    NEW.score = NEW.rating;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to csat_surveys table
DROP TRIGGER IF EXISTS trg_sync_csat_score ON csat_surveys;
CREATE TRIGGER trg_sync_csat_score
BEFORE INSERT OR UPDATE ON csat_surveys
FOR EACH ROW EXECUTE FUNCTION sync_csat_score();

-- End of Phase 1 Migration
