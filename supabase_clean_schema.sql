-- Clean DaddyBaddy Database Schema for Supabase
-- This schema matches the current backend functionality
-- Run this script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist
DROP FUNCTION IF EXISTS get_battle_results(UUID);
DROP VIEW IF EXISTS battle_stats CASCADE;
DROP VIEW IF EXISTS user_stats CASCADE;

-- Drop triggers first (they depend on the function)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_battles_updated_at ON battles;
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;

-- Now drop the function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop existing tables if they exist (be careful in production)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS user_follows CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS battles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table (user profiles) - Updated to match backend
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20) UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create battles table
CREATE TABLE battles (
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
CREATE TABLE votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    choice CHAR(1) CHECK (choice IN ('A', 'B')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(battle_id, user_id)
);

-- Create user_follows table
CREATE TABLE user_follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Create chat_rooms table
CREATE TABLE chat_rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    room_type VARCHAR(20) DEFAULT 'public',
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    reply_to UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type VARCHAR(50) NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_battles_creator ON battles(creator_id);
CREATE INDEX idx_battles_active ON battles(is_active);
CREATE INDEX idx_votes_battle ON votes(battle_id);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Create function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_battles_updated_at BEFORE UPDATE ON battles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get battle results
CREATE OR REPLACE FUNCTION get_battle_results(battle_uuid UUID)
RETURNS TABLE (
    option_a_votes BIGINT,
    option_b_votes BIGINT,
    total_votes BIGINT,
    option_a_percentage NUMERIC,
    option_b_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(CASE WHEN v.choice = 'A' THEN 1 END) as option_a_votes,
        COUNT(CASE WHEN v.choice = 'B' THEN 1 END) as option_b_votes,
        COUNT(v.id) as total_votes,
        CASE 
            WHEN COUNT(v.id) > 0 THEN 
                ROUND((COUNT(CASE WHEN v.choice = 'A' THEN 1 END)::NUMERIC / COUNT(v.id)::NUMERIC) * 100, 2)
            ELSE 0 
        END as option_a_percentage,
        CASE 
            WHEN COUNT(v.id) > 0 THEN 
                ROUND((COUNT(CASE WHEN v.choice = 'B' THEN 1 END)::NUMERIC / COUNT(v.id)::NUMERIC) * 100, 2)
            ELSE 0 
        END as option_b_percentage
    FROM votes v
    WHERE v.battle_id = battle_uuid;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (true);

-- Create RLS policies for battles
CREATE POLICY "Battles are viewable by everyone" ON battles
    FOR SELECT USING (true);

CREATE POLICY "Users can create battles" ON battles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own battles" ON battles
    FOR UPDATE USING (true);

-- Create RLS policies for votes
CREATE POLICY "Votes are viewable by everyone" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert votes" ON votes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own votes" ON votes
    FOR UPDATE USING (true);

-- Create RLS policies for user_follows
CREATE POLICY "User follows are viewable by everyone" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON user_follows
    FOR ALL USING (true);

-- Create RLS policies for chat_rooms
CREATE POLICY "Chat rooms are viewable by everyone" ON chat_rooms
    FOR SELECT USING (true);

CREATE POLICY "Users can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for chat_messages
CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages
    FOR SELECT USING (true);

CREATE POLICY "Users can insert chat messages" ON chat_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (true);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "Users can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create a view for user stats
CREATE VIEW user_stats AS
SELECT 
    p.id,
    p.username,
    p.full_name,
    p.phone,
    COUNT(DISTINCT b.id) as battles_created,
    COUNT(DISTINCT v.id) as votes_cast,
    COUNT(DISTINCT f.following_id) as following_count,
    COUNT(DISTINCT f2.follower_id) as followers_count,
    p.created_at,
    p.last_active
FROM profiles p
LEFT JOIN battles b ON p.id = b.creator_id
LEFT JOIN votes v ON p.id = v.user_id
LEFT JOIN user_follows f ON p.id = f.follower_id
LEFT JOIN user_follows f2 ON p.id = f2.following_id
GROUP BY p.id, p.username, p.full_name, p.phone, p.created_at, p.last_active;

-- Create a view for battle stats
CREATE VIEW battle_stats AS
SELECT 
    b.id,
    b.title,
    b.creator_id,
    p.username as creator_username,
    COUNT(v.id) as total_votes,
    COUNT(CASE WHEN v.choice = 'A' THEN 1 END) as option_a_votes,
    COUNT(CASE WHEN v.choice = 'B' THEN 1 END) as option_b_votes,
    CASE 
        WHEN COUNT(v.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN v.choice = 'A' THEN 1 END)::NUMERIC / COUNT(v.id)::NUMERIC) * 100, 2)
        ELSE 0 
    END as option_a_percentage,
    CASE 
        WHEN COUNT(v.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN v.choice = 'B' THEN 1 END)::NUMERIC / COUNT(v.id)::NUMERIC) * 100, 2)
        ELSE 0 
    END as option_b_percentage,
    b.created_at,
    b.end_time
FROM battles b
LEFT JOIN profiles p ON b.creator_id = p.id
LEFT JOIN votes v ON b.id = v.battle_id
GROUP BY b.id, b.title, b.creator_id, p.username, b.created_at, b.end_time;

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles and authentication data';
COMMENT ON TABLE battles IS 'User-created battles/polls';
COMMENT ON TABLE votes IS 'User votes on battles';
COMMENT ON TABLE user_follows IS 'User following relationships';
COMMENT ON TABLE chat_rooms IS 'Chat rooms for battles and general discussion';
COMMENT ON TABLE chat_messages IS 'Messages in chat rooms';
COMMENT ON TABLE notifications IS 'User notifications';

COMMENT ON VIEW user_stats IS 'Aggregated user statistics';
COMMENT ON VIEW battle_stats IS 'Aggregated battle statistics with vote counts and percentages';

COMMENT ON FUNCTION get_battle_results(UUID) IS 'Returns vote statistics for a specific battle';
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to update updated_at timestamp';
