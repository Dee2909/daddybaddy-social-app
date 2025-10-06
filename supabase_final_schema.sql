-- Final Database Schema for DaddyBaddy Social App
-- This removes dummy data and adds post-to-post functionality

-- First, let's clean up any existing dummy data
DELETE FROM notifications WHERE user_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM follows WHERE follower_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
) OR following_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM votes WHERE user_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM likes WHERE user_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM comments WHERE author_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM battle_participants WHERE user_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM battles WHERE creator_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM posts WHERE author_id IN (
    SELECT id FROM profiles WHERE username IN ('testuser', 'photographer', 'artist')
);

DELETE FROM profiles WHERE username IN ('testuser', 'photographer', 'artist');

-- Now let's add the post-to-post functionality
-- Add a new table for post relationships (replies, quotes, etc.)
CREATE TABLE IF NOT EXISTS post_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    child_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('reply', 'quote', 'repost', 'mention')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_post_id, child_post_id, relationship_type)
);

-- Add indexes for post relationships
CREATE INDEX IF NOT EXISTS idx_post_relationships_parent ON post_relationships(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_post_relationships_child ON post_relationships(child_post_id);
CREATE INDEX IF NOT EXISTS idx_post_relationships_type ON post_relationships(relationship_type);

-- Add a function to get post thread (replies)
CREATE OR REPLACE FUNCTION get_post_thread(post_uuid UUID)
RETURNS TABLE (
    post_id UUID,
    author_id UUID,
    content TEXT,
    media_urls TEXT[],
    hashtags TEXT[],
    likes_count INTEGER,
    comments_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    thread_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE post_thread AS (
        -- Base case: the original post
        SELECT 
            p.id as post_id,
            p.author_id,
            p.content,
            p.media_urls,
            p.hashtags,
            p.likes_count,
            p.comments_count,
            p.created_at,
            0 as thread_level
        FROM posts p
        WHERE p.id = post_uuid
        
        UNION ALL
        
        -- Recursive case: replies to posts in the thread
        SELECT 
            p.id as post_id,
            p.author_id,
            p.content,
            p.media_urls,
            p.hashtags,
            p.likes_count,
            p.comments_count,
            p.created_at,
            pt.thread_level + 1
        FROM posts p
        JOIN post_relationships pr ON p.id = pr.child_post_id
        JOIN post_thread pt ON pr.parent_post_id = pt.post_id
        WHERE pr.relationship_type = 'reply'
    )
    SELECT * FROM post_thread
    ORDER BY thread_level, created_at;
END;
$$ LANGUAGE plpgsql;

-- Add a function to get post quotes
CREATE OR REPLACE FUNCTION get_post_quotes(post_uuid UUID)
RETURNS TABLE (
    post_id UUID,
    author_id UUID,
    content TEXT,
    media_urls TEXT[],
    hashtags TEXT[],
    likes_count INTEGER,
    comments_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    quoted_post_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as post_id,
        p.author_id,
        p.content,
        p.media_urls,
        p.hashtags,
        p.likes_count,
        p.comments_count,
        p.created_at,
        pr.parent_post_id as quoted_post_id
    FROM posts p
    JOIN post_relationships pr ON p.id = pr.child_post_id
    WHERE pr.parent_post_id = post_uuid
    AND pr.relationship_type = 'quote'
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add a function to get post mentions
CREATE OR REPLACE FUNCTION get_post_mentions(post_uuid UUID)
RETURNS TABLE (
    post_id UUID,
    author_id UUID,
    content TEXT,
    media_urls TEXT[],
    hashtags TEXT[],
    likes_count INTEGER,
    comments_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as post_id,
        p.author_id,
        p.content,
        p.media_urls,
        p.hashtags,
        p.likes_count,
        p.comments_count,
        p.created_at
    FROM posts p
    JOIN post_relationships pr ON p.id = pr.child_post_id
    WHERE pr.parent_post_id = post_uuid
    AND pr.relationship_type = 'mention'
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for post_relationships
ALTER TABLE post_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post relationships are viewable by everyone" ON post_relationships FOR SELECT USING (true);
CREATE POLICY "Users can create post relationships" ON post_relationships FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM posts 
        WHERE posts.id = post_relationships.parent_post_id 
        AND posts.author_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM posts 
        WHERE posts.id = post_relationships.child_post_id 
        AND posts.author_id = auth.uid()
    )
);
CREATE POLICY "Users can delete their own post relationships" ON post_relationships FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM posts 
        WHERE posts.id = post_relationships.parent_post_id 
        AND posts.author_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM posts 
        WHERE posts.id = post_relationships.child_post_id 
        AND posts.author_id = auth.uid()
    )
);

-- Add a trigger to update comment counts when post relationships are created/deleted
CREATE OR REPLACE FUNCTION update_post_comment_count_from_relationships()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.relationship_type = 'reply' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.parent_post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.relationship_type = 'reply' THEN
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.parent_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_post_comment_count_from_relationships_trigger
    AFTER INSERT OR DELETE ON post_relationships
    FOR EACH ROW EXECUTE FUNCTION update_post_comment_count_from_relationships();

-- Add a view for enhanced post data with relationships
CREATE OR REPLACE VIEW enhanced_posts AS
SELECT 
    p.*,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    COUNT(DISTINCT l.id) as actual_likes_count,
    COUNT(DISTINCT pr_rel.id) as actual_replies_count,
    COUNT(DISTINCT pr_quote.id) as quote_count,
    COUNT(DISTINCT pr_mention.id) as mention_count
FROM posts p
JOIN profiles pr ON p.author_id = pr.id
LEFT JOIN likes l ON p.id = l.post_id
LEFT JOIN post_relationships pr_rel ON p.id = pr_rel.parent_post_id AND pr_rel.relationship_type = 'reply'
LEFT JOIN post_relationships pr_quote ON p.id = pr_quote.parent_post_id AND pr_quote.relationship_type = 'quote'
LEFT JOIN post_relationships pr_mention ON p.id = pr_mention.parent_post_id AND pr_mention.relationship_type = 'mention'
GROUP BY p.id, pr.username, pr.full_name, pr.avatar_url;

-- Add a function to create a reply to a post
CREATE OR REPLACE FUNCTION create_post_reply(
    parent_post_id UUID,
    reply_content TEXT,
    reply_media_urls TEXT[] DEFAULT NULL,
    reply_hashtags TEXT[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_post_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Create the reply post
    INSERT INTO posts (author_id, content, media_urls, hashtags)
    VALUES (current_user_id, reply_content, reply_media_urls, reply_hashtags)
    RETURNING id INTO new_post_id;
    
    -- Create the relationship
    INSERT INTO post_relationships (parent_post_id, child_post_id, relationship_type)
    VALUES (parent_post_id, new_post_id, 'reply');
    
    RETURN new_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to create a quote post
CREATE OR REPLACE FUNCTION create_post_quote(
    quoted_post_id UUID,
    quote_content TEXT,
    quote_media_urls TEXT[] DEFAULT NULL,
    quote_hashtags TEXT[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_post_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Create the quote post
    INSERT INTO posts (author_id, content, media_urls, hashtags)
    VALUES (current_user_id, quote_content, quote_media_urls, quote_hashtags)
    RETURNING id INTO new_post_id;
    
    -- Create the relationship
    INSERT INTO post_relationships (parent_post_id, child_post_id, relationship_type)
    VALUES (quoted_post_id, new_post_id, 'quote');
    
    RETURN new_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to create a repost
CREATE OR REPLACE FUNCTION create_post_repost(
    original_post_id UUID
)
RETURNS UUID AS $$
DECLARE
    new_post_id UUID;
    current_user_id UUID;
    original_post RECORD;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Get original post data
    SELECT * INTO original_post FROM posts WHERE id = original_post_id;
    
    -- Create the repost
    INSERT INTO posts (author_id, content, media_urls, hashtags)
    VALUES (current_user_id, original_post.content, original_post.media_urls, original_post.hashtags)
    RETURNING id INTO new_post_id;
    
    -- Create the relationship
    INSERT INTO post_relationships (parent_post_id, child_post_id, relationship_type)
    VALUES (original_post_id, new_post_id, 'repost');
    
    RETURN new_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to get post feed with relationships
CREATE OR REPLACE FUNCTION get_enhanced_post_feed(
    user_id UUID,
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    post_id UUID,
    author_id UUID,
    username VARCHAR,
    full_name VARCHAR,
    avatar_url TEXT,
    content TEXT,
    media_urls TEXT[],
    hashtags TEXT[],
    likes_count INTEGER,
    comments_count INTEGER,
    quote_count INTEGER,
    mention_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    is_liked BOOLEAN,
    post_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ep.id as post_id,
        ep.author_id,
        ep.username,
        ep.full_name,
        ep.avatar_url,
        ep.content,
        ep.media_urls,
        ep.hashtags,
        ep.actual_likes_count as likes_count,
        ep.actual_replies_count as comments_count,
        ep.quote_count,
        ep.mention_count,
        ep.created_at,
        EXISTS(
            SELECT 1 FROM likes l 
            WHERE l.post_id = ep.id AND l.user_id = user_id
        ) as is_liked,
        'post' as post_type
    FROM enhanced_posts ep
    WHERE ep.author_id IN (
        SELECT following_id FROM follows WHERE follower_id = user_id
        UNION
        SELECT user_id
    )
    ORDER BY ep.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_post_thread(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_quotes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_mentions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_post_reply(UUID, TEXT, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_post_quote(UUID, TEXT, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_post_repost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enhanced_post_feed(UUID, INTEGER, INTEGER) TO authenticated;

-- Create some sample data for testing (realistic data)
INSERT INTO profiles (id, username, full_name, email, phone, avatar_url, bio, verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'johndoe', 'John Doe', 'john@example.com', '+1234567890', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', 'Photography enthusiast and battle creator', true),
('550e8400-e29b-41d4-a716-446655440001', 'sarah_photo', 'Sarah Johnson', 'sarah@example.com', '+1234567891', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face', 'Professional photographer and digital artist', true),
('550e8400-e29b-41d4-a716-446655440002', 'mike_creative', 'Mike Chen', 'mike@example.com', '+1234567892', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', 'Creative director and battle strategist', true);

-- Create sample posts
INSERT INTO posts (author_id, content, media_urls, hashtags) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Just finished an amazing photo shoot! The lighting was perfect today. 📸', ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop'], ARRAY['photography', 'lighting', 'creative']),
('550e8400-e29b-41d4-a716-446655440001', 'Working on a new digital art piece. The colors are coming together beautifully! ✨', ARRAY['https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop'], ARRAY['digitalart', 'creative', 'colors']),
('550e8400-e29b-41d4-a716-446655440002', 'Battle time! Who thinks they can beat this shot? 🥊', ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop'], ARRAY['battle', 'photography', 'challenge']);

-- Create sample battles
INSERT INTO battles (creator_id, title, description, media_urls, status, visibility) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Sunset Photography Challenge', 'Who can capture the best sunset?', ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop'], 'ongoing', 'public'),
('550e8400-e29b-41d4-a716-446655440001', 'Portrait Mastery Battle', 'Best portrait photography wins!', ARRAY['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'], 'ongoing', 'public');

-- Create sample follows
INSERT INTO follows (follower_id, following_id) VALUES
('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000');

-- Create sample notifications
INSERT INTO notifications (user_id, type, title, content, data) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'follow', 'New Follower', 'sarah_photo started following you', '{"follower_id": "550e8400-e29b-41d4-a716-446655440001"}'),
('550e8400-e29b-41d4-a716-446655440000', 'like', 'Post Liked', 'Someone liked your post', '{"post_id": "550e8400-e29b-41d4-a716-446655440003"}'),
('550e8400-e29b-41d4-a716-446655440001', 'battle_invite', 'Battle Invitation', 'You have been invited to a new battle', '{"battle_id": "550e8400-e29b-41d4-a716-446655440004"}');

-- Create sample post relationships (replies)
INSERT INTO post_relationships (parent_post_id, child_post_id, relationship_type) VALUES
((SELECT id FROM posts WHERE content LIKE '%amazing photo shoot%'), (SELECT id FROM posts WHERE content LIKE '%digital art piece%'), 'reply'),
((SELECT id FROM posts WHERE content LIKE '%digital art piece%'), (SELECT id FROM posts WHERE content LIKE '%Battle time%'), 'reply');

-- Update the comment counts
UPDATE posts SET comments_count = (
    SELECT COUNT(*) FROM post_relationships 
    WHERE parent_post_id = posts.id AND relationship_type = 'reply'
);

