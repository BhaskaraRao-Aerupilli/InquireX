-- InquireX Supabase Reports Table Schema
-- Run once in Supabase Dashboard -> SQL Editor to enable cloud per-user report persistence.

CREATE TABLE IF NOT EXISTS public.reports (
    id            TEXT PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question      TEXT,
    answer        TEXT,
    ordered_data  JSONB NOT NULL DEFAULT '[]'::jsonb,
    chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp     BIGINT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_ts
    ON public.reports (user_id, timestamp DESC);

-- Enable Row Level Security (InquireX FastAPI backend uses service_role and filters by authenticated user_id)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
