-- Add signature_url to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Update RLS policies if needed (usually profiles are already editable by owners)
COMMENT ON COLUMN public.profiles.signature_url IS 'URL of the staff digital signature image';
