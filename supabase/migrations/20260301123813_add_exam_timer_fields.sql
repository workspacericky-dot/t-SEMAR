-- Add exam timer columns to audits table
ALTER TABLE audits 
ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS exam_start_time TIMESTAMP WITH TIME ZONE;
