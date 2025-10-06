-- Complete Database Schema for DaddyBaddy Social App
-- This includes all tables needed for the full application

-- Drop existing tables if they exist (in correct order to avoid foreign key constraints)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS battle_participants CASCADE;
DROP TABLE IF EXISTS battles CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table (users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website TEXT,
    password_hash VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_urls TEXT[],
    hashtags TEXT[],
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create battles table
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_urls TEXT[] NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'completed', 'cancelled')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'close_friends')),
    vote_counts JSONB DEFAULT '{}',
    total_votes INTEGER DEFAULT 0,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create battle_participants table (many-to-many relationship)
CREATE TABLE battle_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(battle_id, user_id)
);

-- Create votes table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    choice VARCHAR(10) NOT NULL CHECK (choice IN ('A', 'B')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(battle_id, user_id)
);

-- Create likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follows table
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Create chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    participant_ids UUID[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'battle_invite', 'battle_result', 'vote', 'message')),
    title VARCHAR(200) NOT NULL,
    content TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_battles_creator_id ON battles(creator_id);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_created_at ON battles(created_at DESC);
CREATE INDEX idx_battle_participants_battle_id ON battle_participants(battle_id);
CREATE INDEX idx_battle_participants_user_id ON battle_participants(user_id);
CREATE INDEX idx_votes_battle_id ON votes(battle_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_battles_updated_at BEFORE UPDATE ON battles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update like counts
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for updating like counts
CREATE TRIGGER update_post_likes_count_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Create function to update comment counts
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for updating comment counts
CREATE TRIGGER update_post_comments_count_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Create function to update battle vote counts
CREATE OR REPLACE FUNCTION update_battle_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
    battle_vote_counts JSONB;
    choice_count INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get current vote counts
        SELECT vote_counts INTO battle_vote_counts FROM battles WHERE id = NEW.battle_id;
        
        -- Initialize if null
        IF battle_vote_counts IS NULL THEN
            battle_vote_counts := '{}';
        END IF;
        
        -- Increment the choice count
        choice_count := COALESCE((battle_vote_counts->>NEW.choice)::INTEGER, 0) + 1;
        battle_vote_counts := jsonb_set(battle_vote_counts, ARRAY[NEW.choice], to_jsonb(choice_count));
        
        -- Update the battle
        UPDATE battles SET 
            vote_counts = battle_vote_counts,
            total_votes = total_votes + 1
        WHERE id = NEW.battle_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Get current vote counts
        SELECT vote_counts INTO battle_vote_counts FROM battles WHERE id = OLD.battle_id;
        
        -- Decrement the choice count
        choice_count := COALESCE((battle_vote_counts->>OLD.choice)::INTEGER, 0) - 1;
        battle_vote_counts := jsonb_set(battle_vote_counts, ARRAY[OLD.choice], to_jsonb(GREATEST(choice_count, 0)));
        
        -- Update the battle
        UPDATE battles SET 
            vote_counts = battle_vote_counts,
            total_votes = GREATEST(total_votes - 1, 0)
        WHERE id = OLD.battle_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for updating battle vote counts
CREATE TRIGGER update_battle_vote_counts_trigger
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_battle_vote_counts();

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can view all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: Users can view all posts, but only create/update/delete their own
CREATE POLICY "Public posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = author_id);

-- Battles: Users can view all battles, but only create/update/delete their own
CREATE POLICY "Public battles are viewable by everyone" ON battles FOR SELECT USING (true);
CREATE POLICY "Users can create battles" ON battles FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own battles" ON battles FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own battles" ON battles FOR DELETE USING (auth.uid() = creator_id);

-- Battle participants: Users can view all, but only insert/update their own
CREATE POLICY "Battle participants are viewable by everyone" ON battle_participants FOR SELECT USING (true);
CREATE POLICY "Users can join battles" ON battle_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own battle participation" ON battle_participants FOR UPDATE USING (auth.uid() = user_id);

-- Votes: Users can view all votes, but only create their own
CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);
CREATE POLICY "Users can create votes" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Likes: Users can view all likes, but only create/delete their own
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can create likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: Users can view all comments, but only create/update/delete their own
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own comments" ON comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = author_id);

-- Follows: Users can view all follows, but only create/delete their own
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can create follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Chats: Users can only see chats they participate in
CREATE POLICY "Users can view their own chats" ON chats FOR SELECT USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "Users can create chats" ON chats FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));
CREATE POLICY "Users can update their own chats" ON chats FOR UPDATE USING (auth.uid() = ANY(participant_ids));

-- Messages: Users can only see messages from chats they participate in
CREATE POLICY "Users can view messages from their chats" ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM chats 
        WHERE chats.id = messages.chat_id 
        AND auth.uid() = ANY(chats.participant_ids)
    )
);
CREATE POLICY "Users can create messages in their chats" ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM chats 
        WHERE chats.id = messages.chat_id 
        AND auth.uid() = ANY(chats.participant_ids)
    )
);

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Create views for easier querying
CREATE VIEW user_stats AS
SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    COUNT(DISTINCT f1.following_id) as following_count,
    COUNT(DISTINCT f2.follower_id) as followers_count,
    COUNT(DISTINCT b.id) as battles_created,
    COUNT(DISTINCT bp.battle_id) as battles_participant,
    COUNT(DISTINCT v.battle_id) as battles_voted,
    COUNT(DISTINCT po.id) as posts_created,
    COUNT(DISTINCT l.post_id) as posts_liked
FROM profiles p
LEFT JOIN follows f1 ON p.id = f1.follower_id
LEFT JOIN follows f2 ON p.id = f2.following_id
LEFT JOIN battles b ON p.id = b.creator_id
LEFT JOIN battle_participants bp ON p.id = bp.user_id
LEFT JOIN votes v ON p.id = v.user_id
LEFT JOIN posts po ON p.id = po.author_id
LEFT JOIN likes l ON p.id = l.user_id
GROUP BY p.id, p.username, p.full_name, p.avatar_url;

-- Create function to get battle results
CREATE OR REPLACE FUNCTION get_battle_results(battle_uuid UUID)
RETURNS TABLE (
    choice VARCHAR(10),
    count BIGINT,
    percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.choice,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER(), 0), 2) as percentage
    FROM votes v
    WHERE v.battle_id = battle_uuid
    GROUP BY v.choice
    ORDER BY v.choice;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO profiles (id, username, full_name, email, phone, avatar_url, bio, verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'testuser', 'Test User', 'test@example.com', '+1234567890', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', 'Test user account', true),
('550e8400-e29b-41d4-a716-446655440001', 'photographer', 'John Photographer', 'john@example.com', '+1234567891', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face', 'Professional photographer', true),
('550e8400-e29b-41d4-a716-446655440002', 'artist', 'Jane Artist', 'jane@example.com', '+1234567892', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', 'Digital artist and designer', true);

-- Insert sample posts
INSERT INTO posts (author_id, content, media_urls, hashtags) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Beautiful sunset today! 🌅', ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'], ARRAY['sunset', 'photography', 'nature']),
('550e8400-e29b-41d4-a716-446655440001', 'New portrait session completed!', ARRAY['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=800&h=600&fit=crop'], ARRAY['portrait', 'photography', 'professional']),
('550e8400-e29b-41d4-a716-446655440002', 'Working on a new digital art piece', ARRAY['https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop'], ARRAY['digitalart', 'creative', 'design']);

-- Insert sample battles
INSERT INTO battles (creator_id, title, description, media_urls, status, visibility) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Sunset Photography Battle', 'Who has the better sunset shot?', ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop'], 'ongoing', 'public'),
('550e8400-e29b-41d4-a716-446655440001', 'Portrait Challenge', 'Best portrait photography', ARRAY['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'], 'ongoing', 'public');

-- Insert sample battle participants
INSERT INTO battle_participants (battle_id, user_id, status) VALUES
((SELECT id FROM battles WHERE title = 'Sunset Photography Battle'), '550e8400-e29b-41d4-a716-446655440001', 'accepted'),
((SELECT id FROM battles WHERE title = 'Portrait Challenge'), '550e8400-e29b-41d4-a716-446655440002', 'accepted');

-- Insert sample follows
INSERT INTO follows (follower_id, following_id) VALUES
('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, content, data) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'follow', 'New Follower', 'photographer started following you', '{"follower_id": "550e8400-e29b-41d4-a716-446655440001"}'),
('550e8400-e29b-41d4-a716-446655440000', 'battle_invite', 'Battle Invitation', 'You have been invited to a new battle', '{"battle_id": "550e8400-e29b-41d4-a716-446655440003"}'),
('550e8400-e29b-41d4-a716-446655440001', 'like', 'Post Liked', 'Someone liked your post', '{"post_id": "550e8400-e29b-41d4-a716-446655440004"}');

