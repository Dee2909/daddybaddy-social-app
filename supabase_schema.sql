-- DaddyBaddy Database Schema for Supabase
-- Run this script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (user profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20) UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    password_hash VARCHAR(64),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create battles table
CREATE TABLE IF NOT EXISTS battles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    option_a VARCHAR(200) NOT NULL,
    option_b VARCHAR(200) NOT NULL,
    image_a_url TEXT,
    image_b_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    choice CHAR(1) CHECK (choice IN ('A', 'B')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(battle_id, user_id)
);

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    room_type VARCHAR(20) DEFAULT 'public',
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    reply_to UUID REFERENCES chat_messages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type VARCHAR(50) NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_battles_creator_id ON battles(creator_id);
CREATE INDEX IF NOT EXISTS idx_battles_created_at ON battles(created_at);
CREATE INDEX IF NOT EXISTS idx_battles_active ON battles(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_battle_id ON votes(battle_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_battle_choice ON votes(battle_id, choice);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Battles policies
CREATE POLICY "Anyone can view active battles" ON battles
    FOR SELECT USING (is_active = true);

CREATE POLICY "Battle creators can view their own battles" ON battles
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can create battles" ON battles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Battle creators can update their battles" ON battles
    FOR UPDATE USING (auth.uid() = creator_id);

-- Votes policies
CREATE POLICY "Users can view votes for active battles" ON votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM battles 
            WHERE battles.id = votes.battle_id 
            AND battles.is_active = true
        )
    );

CREATE POLICY "Users can vote on active battles" ON votes
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM battles 
            WHERE battles.id = battle_id 
            AND battles.is_active = true
        )
    );

CREATE POLICY "Users can update their own votes" ON votes
    FOR UPDATE USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM battles 
            WHERE battles.id = battle_id 
            AND battles.is_active = true
        )
    );

-- Chat rooms policies
CREATE POLICY "Anyone can view public chat rooms" ON chat_rooms
    FOR SELECT USING (room_type = 'public' AND is_active = true);

CREATE POLICY "Authenticated users can create chat rooms" ON chat_rooms
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Chat messages policies
CREATE POLICY "Users can view messages in public rooms" ON chat_messages
    FOR SELECT USING (
        NOT is_deleted 
        AND EXISTS (
            SELECT 1 FROM chat_rooms 
            WHERE chat_rooms.id = chat_messages.room_id 
            AND chat_rooms.room_type = 'public' 
            AND chat_rooms.is_active = true
        )
    );

CREATE POLICY "Users can send messages to public rooms" ON chat_messages
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM chat_rooms 
            WHERE chat_rooms.id = room_id 
            AND chat_rooms.room_type = 'public'
            AND chat_rooms.is_active = true
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- User follows policies
CREATE POLICY "Anyone can view follow relationships" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can create follow relationships" ON user_follows
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = follower_id 
        AND follower_id != following_id
    );

CREATE POLICY "Users can delete their own follows" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Functions for battle results
CREATE OR REPLACE FUNCTION get_battle_results(battle_uuid UUID)
RETURNS TABLE (
    choice CHAR(1),
    vote_count BIGINT,
    percentage NUMERIC(5,2)
) AS $$
DECLARE
    total_votes BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_votes FROM votes WHERE battle_id = battle_uuid;
    
    RETURN QUERY
    SELECT 
        v.choice,
        COUNT(*) as vote_count,
        CASE 
            WHEN total_votes > 0 THEN ROUND((COUNT(*)::NUMERIC / total_votes) * 100, 2)
            ELSE 0
        END as percentage
    FROM votes v
    WHERE v.battle_id = battle_uuid
    GROUP BY v.choice;
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Realtime for real-time features
ALTER PUBLICATION supabase_realtime ADD TABLE battles;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;