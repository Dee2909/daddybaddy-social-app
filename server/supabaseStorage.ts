import { supabase } from './supabase';
import type { 
  User, 
  InsertUser, 
  Battle, 
  InsertBattle, 
  BattleParticipant, 
  InsertBattleParticipant, 
  Post, 
  InsertPost, 
  Vote, 
  InsertVote, 
  Comment, 
  InsertComment, 
  Like, 
  InsertLike, 
  Follow, 
  InsertFollow, 
  CloseFriend, 
  InsertCloseFriend, 
  Message, 
  InsertMessage, 
  Notification, 
  InsertNotification, 
  Otp, 
  InsertOtp, 
  VerifyOtp,
  PostWithAuthor
} from '@shared/types';

export class SupabaseStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      // If it's a "not found" error, return undefined (user doesn't exist)
      if (error.code === 'PGRST116') {
        return undefined;
      }
      // For other errors, log and return undefined
      console.error('Error getting user by email:', error);
      return undefined;
    }
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      console.error('Error getting user by username:', error);
      return undefined;
    }
    return data as User;
  }

  async getUserByPhone(phone: string, countryCode: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('country_code', countryCode)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      console.error('Error getting user by phone:', error);
      return undefined;
    }
    return data as User;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create user: ${error.message}`);
    return data as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update user: ${error.message}`);
    return updatedUser as User;
  }

  async searchUsers(query: string, excludeUserId?: string, limit = 20): Promise<User[]> {
    let queryBuilder = supabase
      .from('users')
      .select(`
        id,
        username,
        first_name,
        last_name,
        profile_image_url,
        bio,
        external_link,
        is_private,
        verified,
        created_at
      `)
      .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(limit);

    // Exclude the current user from search results
    if (excludeUserId) {
      queryBuilder = queryBuilder.neq('id', excludeUserId);
    }

    const { data, error } = await queryBuilder;
    
    if (error) throw new Error(`Failed to search users: ${error.message}`);
    return data as User[];
  }

  // Battle operations
  async getBattles(limit = 50, offset = 0): Promise<Battle[]> {
    const { data, error } = await supabase
      .from('battles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw new Error(`Failed to get battles: ${error.message}`);
    return data as Battle[];
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    const { data, error } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as Battle;
  }

  async createBattle(battleData: InsertBattle): Promise<Battle> {
    const { data, error } = await supabase
      .from('battles')
      .insert(battleData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create battle: ${error.message}`);
    return data as Battle;
  }

  async updateBattle(id: string, data: Partial<Battle>): Promise<Battle> {
    const { data: updatedBattle, error } = await supabase
      .from('battles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update battle: ${error.message}`);
    return updatedBattle as Battle;
  }

  // Battle participant operations
  async getBattleParticipants(battleId: string): Promise<BattleParticipant[]> {
    const { data, error } = await supabase
      .from('battle_participants')
      .select('*')
      .eq('battle_id', battleId);
    
    if (error) throw new Error(`Failed to get battle participants: ${error.message}`);
    return data as BattleParticipant[];
  }

  async createBattleParticipant(participantData: InsertBattleParticipant): Promise<BattleParticipant> {
    const { data, error } = await supabase
      .from('battle_participants')
      .insert(participantData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create battle participant: ${error.message}`);
    return data as BattleParticipant;
  }

  async updateBattleParticipant(id: string, data: Partial<BattleParticipant>): Promise<BattleParticipant> {
    const { data: updatedParticipant, error } = await supabase
      .from('battle_participants')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update battle participant: ${error.message}`);
    return updatedParticipant as BattleParticipant;
  }

  // Vote operations
  async getVotes(battleId: string): Promise<Vote[]> {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('battle_id', battleId);
    
    if (error) throw new Error(`Failed to get votes: ${error.message}`);
    return data as Vote[];
  }

  async createVote(voteData: InsertVote): Promise<Vote> {
    const { data, error } = await supabase
      .from('votes')
      .insert(voteData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create vote: ${error.message}`);
    return data as Vote;
  }

  async getUserVoteForBattle(voterId: string, battleId: string): Promise<Vote | undefined> {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('voter_id', voterId)
      .eq('battle_id', battleId)
      .single();
    
    if (error) return undefined;
    return data as Vote;
  }

  // Post operations
  async getPosts(limit = 50, offset = 0): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw new Error(`Failed to get posts: ${error.message}`);
    return data as Post[];
  }

  async createPost(postData: InsertPost): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create post: ${error.message}`);
    return data as Post;
  }


  // Like operations
  async createLike(likeData: InsertLike): Promise<Like> {
    const { data, error } = await supabase
      .from('likes')
      .insert(likeData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create like: ${error.message}`);
    return data as Like;
  }

  async deleteLike(userId: string, postId: string): Promise<void> {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);
    
    if (error) throw new Error(`Failed to delete like: ${error.message}`);
  }

  // Comment operations
  async getComments(battleId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('battle_id', battleId)
      .order('created_at', { ascending: true });
    
    if (error) throw new Error(`Failed to get comments: ${error.message}`);
    return data as Comment[];
  }

  async createComment(commentData: InsertComment): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create comment: ${error.message}`);
    return data as Comment;
  }

  // Follow operations
  async followUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });
    
    if (error) throw new Error(`Failed to follow user: ${error.message}`);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    
    if (error) throw new Error(`Failed to unfollow user: ${error.message}`);
  }

  async getUserFollowers(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        *,
        follower:users!follows_follower_id_fkey(*)
      `)
      .eq('following_id', userId);
    
    if (error) throw new Error(`Failed to get user followers: ${error.message}`);
    return data || [];
  }

  async getUserFollowing(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        *,
        following:users!follows_following_id_fkey(*)
      `)
      .eq('follower_id', userId);
    
    if (error) throw new Error(`Failed to get user following: ${error.message}`);
    return data || [];
  }

  // Message operations
  async getConversationMessages(userId: string, otherUserId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    
    if (error) throw new Error(`Failed to get conversation messages: ${error.message}`);
    return data as Message[];
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return data as Message;
  }

  // Notification operations
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to get user notifications: ${error.message}`);
    return data as Notification[];
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create notification: ${error.message}`);
    return data as Notification;
  }

  // OTP operations
  async createOTP(otpData: InsertOtp): Promise<Otp> {
    const { data, error } = await supabase
      .from('otps')
      .insert(otpData)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create OTP: ${error.message}`);
    return data as Otp;
  }

  async getOTP(email: string, code: string, type: string): Promise<Otp | null> {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', type)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error) return null;
    return data as Otp;
  }

  async verifyOTP(otpData: VerifyOtp): Promise<Otp | null> {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', otpData.email)
      .eq('code', otpData.code)
      .eq('type', otpData.type)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error) return null;
    return data as Otp;
  }

  async markOTPAsUsed(otpId: string): Promise<void> {
    const { error } = await supabase
      .from('otps')
      .update({ used: true })
      .eq('id', otpId);
    
    if (error) throw new Error(`Failed to mark OTP as used: ${error.message}`);
  }

  async cleanupExpiredOTPs(): Promise<void> {
    const { error } = await supabase
      .from('otps')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (error) throw new Error(`Failed to cleanup expired OTPs: ${error.message}`);
  }

  // Stats operations
  async getUserStats(userId: string): Promise<any> {
    const [battlesResult, postsResult, followersResult, followingResult] = await Promise.all([
      supabase.from('battles').select('id').eq('creator_id', userId),
      supabase.from('posts').select('id').eq('author_id', userId),
      supabase.from('follows').select('id').eq('following_id', userId),
      supabase.from('follows').select('id').eq('follower_id', userId)
    ]);

    return {
      battlesCreated: battlesResult.data?.length || 0,
      postsCreated: postsResult.data?.length || 0,
      followersCount: followersResult.data?.length || 0,
      followingCount: followingResult.data?.length || 0
    };
  }

  async getTopUsers(limit = 50): Promise<any[]> {
    // For now, return a simple list of users without complex follower counts
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        first_name,
        last_name,
        profile_image_url,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw new Error(`Failed to get top users: ${error.message}`);
    return data || [];
  }

  async getUserRanking(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        followers:follows!follows_following_id_fkey(count)
      `)
      .order('followers.count', { ascending: false });
    
    if (error) throw new Error(`Failed to get user ranking: ${error.message}`);
    
    const userIndex = data?.findIndex(user => user.id === userId);
    return userIndex !== undefined ? userIndex + 1 : 0;
  }

  // Additional methods for compatibility
  async updateUserProfile(id: string, data: Partial<User>): Promise<User> {
    return this.updateUser(id, data);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();
    
    return !error && !!data;
  }

  async addBattleParticipant(participantData: InsertBattleParticipant): Promise<BattleParticipant> {
    return this.createBattleParticipant(participantData);
  }

  async getBattleComments(battleId: string): Promise<Comment[]> {
    return this.getComments(battleId);
  }

  async acceptBattleInvite(participantId: string): Promise<BattleParticipant> {
    return this.updateBattleParticipant(participantId, { status: 'accepted' });
  }

  async updateBattleStatus(battleId: string, status: string): Promise<Battle> {
    return this.updateBattle(battleId, { status: status as any });
  }

  async castVote(voteData: InsertVote): Promise<Vote> {
    return this.createVote(voteData);
  }

  async getBattleVoteCounts(battleId: string): Promise<any[]> {
    // Get all votes for the battle and count them manually
    const { data, error } = await supabase
      .from('votes')
      .select('participant_id')
      .eq('battle_id', battleId);
    
    if (error) throw new Error(`Failed to get battle vote counts: ${error.message}`);
    
    // Count votes per participant
    const voteCounts: { [key: string]: number } = {};
    data?.forEach(vote => {
      voteCounts[vote.participant_id] = (voteCounts[vote.participant_id] || 0) + 1;
    });
    
    return Object.entries(voteCounts).map(([participant_id, count]) => ({
      participant_id,
      count
    }));
  }

  async updateParticipantVoteCount(participantId: string, voteCount: number): Promise<void> {
    // This would need to be implemented based on your specific requirements
    // For now, we'll just log it
    console.log(`Updating participant ${participantId} vote count to ${voteCount}`);
  }

  async getBattleFeed(limit = 50, offset = 0): Promise<Battle[]> {
    return this.getBattles(limit, offset);
  }

  async getPostsFeed(limit = 50, offset = 0): Promise<Post[]> {
    return this.getPosts(limit, offset);
  }

  async likePost(userId: string, postId: string): Promise<Like> {
    return this.createLike({ user_id: userId, post_id: postId });
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    return this.deleteLike(userId, postId);
  }

  async addComment(commentData: InsertComment): Promise<Comment> {
    return this.createComment(commentData);
  }

  async getConversations(userId: string): Promise<any[]> {
    // This would need to be implemented based on your specific requirements
    return [];
  }

  async getUserBattles(userId: string): Promise<Battle[]> {
    const { data, error } = await supabase
      .from('battles')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get user battles: ${error.message}`);
    return data as Battle[];
  }

  async getUserPosts(userId: string): Promise<PostWithAuthor[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:users!posts_author_id_fkey(*)
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get user posts: ${error.message}`);
    
    return data.map((post: any) => ({
      post: {
        id: post.id,
        author_id: post.author_id,
        content: post.content,
        image_url: post.image_url,
        created_at: post.created_at,
        updated_at: post.updated_at,
      },
      author: post.author,
      likes: 0, // This would need to be calculated
      userLiked: false, // This would need to be checked
      isLiked: false,
    }));
  }

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId);
    
    if (error) throw new Error(`Failed to mark messages as read: ${error.message}`);
  }

  async sendMessage(messageData: InsertMessage): Promise<Message> {
    return this.createMessage(messageData);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    
    if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  async getActiveBattles(): Promise<Battle[]> {
    const { data, error } = await supabase
      .from('battles')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to get active battles: ${error.message}`);
    return data as Battle[];
  }
}

export const storage = new SupabaseStorage();