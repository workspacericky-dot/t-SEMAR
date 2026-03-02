-- Migration to support Exam Scheduling and Manual Locks
ALTER TABLE public.audits 
ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ, 
ADD COLUMN IF NOT EXISTS is_manually_locked BOOLEAN NOT NULL DEFAULT FALSE;
