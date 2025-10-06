-- Battle Module Migration for DaddyBaddy (MVP)
-- Run this in Supabase SQL editor before enabling new battle flows.

-- 1) Extend battles table with lifecycle + metadata
ALTER TABLE battles
    ADD COLUMN IF NOT EXISTS type TEXT,                            -- 'USER' | 'GLOBAL'
    ADD COLUMN IF NOT EXISTS mode TEXT,                            -- '1v1' | 'multi'
    ADD COLUMN IF NOT EXISTS status TEXT,                          -- 'INVITED' | 'UPLOADING' | 'LIVE' | 'ENDED' | 'CANCELLED'
    ADD COLUMN IF NOT EXISTS accept_deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submission_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submission_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS entry_fee NUMERIC,
    ADD COLUMN IF NOT EXISTS invited_user_ids JSONB,
    ADD COLUMN IF NOT EXISTS accepted_user_ids JSONB,
    ADD COLUMN IF NOT EXISTS participant_ids JSONB,
    ADD COLUMN IF NOT EXISTS vote_counts JSONB;

-- 2) Private Battle Comments
CREATE TABLE IF NOT EXISTS private_battle_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '[]'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    is_reported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_comments_battle ON private_battle_comments(battle_id);
CREATE INDEX IF NOT EXISTS idx_private_comments_creator ON private_battle_comments(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_comments_author ON private_battle_comments(author_id);

-- 2b) Battle Submissions (per-user uploads per battle)
CREATE TABLE IF NOT EXISTS battle_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(battle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bsub_battle ON battle_submissions(battle_id);
CREATE INDEX IF NOT EXISTS idx_bsub_user ON battle_submissions(user_id);

-- 3) Enforce unique vote per user per battle (anti-abuse MVP)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname = 'uniq_vote_per_user_battle'
    ) THEN
        CREATE UNIQUE INDEX uniq_vote_per_user_battle ON votes(battle_id, user_id);
    END IF;
END $$;

-- 4) RLS policies (if RLS enabled elsewhere)
ALTER TABLE private_battle_comments ENABLE ROW LEVEL SECURITY;

-- Policies: use DO blocks for idempotency since CREATE POLICY IF NOT EXISTS may not be supported
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polname = 'Authors can insert private comments' 
          AND polrelid = 'private_battle_comments'::regclass
    ) THEN
        CREATE POLICY "Authors can insert private comments"
        ON private_battle_comments
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = author_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polname = 'Creator can read private comments' 
          AND polrelid = 'private_battle_comments'::regclass
    ) THEN
        CREATE POLICY "Creator can read private comments"
        ON private_battle_comments
        FOR SELECT TO authenticated
        USING (auth.uid() = creator_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy 
        WHERE polname = 'Creator can delete private comments' 
          AND polrelid = 'private_battle_comments'::regclass
    ) THEN
        CREATE POLICY "Creator can delete private comments"
        ON private_battle_comments
        FOR DELETE TO authenticated
        USING (auth.uid() = creator_id);
    END IF;
END $$;
