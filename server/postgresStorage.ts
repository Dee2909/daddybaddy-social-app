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
  VerifyOtp 
} from '@shared/types';

export class PostgresStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] as User;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await pool.query(`
      INSERT INTO users (email, password, first_name, last_name, profile_image_url, username, bio, external_link, is_private, verified, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userData.email,
      userData.password,
      userData.first_name || null,
      userData.last_name || null,
      userData.profile_image_url || null,
      userData.username || null,
      userData.bio || null,
      userData.external_link || null,
      userData.is_private || false,
      userData.verified || false,
      userData.email_verified || false
    ]);
    return result.rows[0] as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map((key, index) => `${key} = $${index + 2}`);
    const query = `UPDATE users SET ${values.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof User])];
    
    const result = await pool.query(query, params);
    return result.rows[0] as User;
  }

  async searchUsers(query: string, limit = 20): Promise<User[]> {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
      LIMIT $2
    `, [`%${query}%`, limit]);
    return result.rows as User[];
  }

  // Battle operations
  async getBattles(limit = 50, offset = 0): Promise<Battle[]> {
    const result = await pool.query(`
      SELECT * FROM battles 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows as Battle[];
  }

  async getBattle(id: string): Promise<Battle | undefined> {
    const result = await pool.query('SELECT * FROM battles WHERE id = $1', [id]);
    return result.rows[0] as Battle;
  }

  async createBattle(battleData: InsertBattle): Promise<Battle> {
    const result = await pool.query(`
      INSERT INTO battles (creator_id, title, description, start_time, end_time, status, winner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      battleData.creator_id,
      battleData.title,
      battleData.description || null,
      battleData.start_time,
      battleData.end_time,
      battleData.status || 'active',
      battleData.winner_id || null
    ]);
    return result.rows[0] as Battle;
  }

  async updateBattle(id: string, data: Partial<Battle>): Promise<Battle> {
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map((key, index) => `${key} = $${index + 2}`);
    const query = `UPDATE battles SET ${values.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof Battle])];
    
    const result = await pool.query(query, params);
    return result.rows[0] as Battle;
  }

  // Battle participant operations
  async getBattleParticipants(battleId: string): Promise<BattleParticipant[]> {
    const result = await pool.query('SELECT * FROM battle_participants WHERE battle_id = $1', [battleId]);
    return result.rows as BattleParticipant[];
  }

  async createBattleParticipant(participantData: InsertBattleParticipant): Promise<BattleParticipant> {
    const result = await pool.query(`
      INSERT INTO battle_participants (battle_id, user_id, photo_url, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      participantData.battle_id,
      participantData.user_id,
      participantData.photo_url,
      participantData.status || 'pending'
    ]);
    return result.rows[0] as BattleParticipant;
  }

  async updateBattleParticipant(id: string, data: Partial<BattleParticipant>): Promise<BattleParticipant> {
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map((key, index) => `${key} = $${index + 2}`);
    const query = `UPDATE battle_participants SET ${values.join(', ')} WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof BattleParticipant])];
    
    const result = await pool.query(query, params);
    return result.rows[0] as BattleParticipant;
  }

  // Vote operations
  async getVotes(battleId: string): Promise<Vote[]> {
    const result = await pool.query('SELECT * FROM votes WHERE battle_id = $1', [battleId]);
    return result.rows as Vote[];
  }

  async createVote(voteData: InsertVote): Promise<Vote> {
    const result = await pool.query(`
      INSERT INTO votes (battle_id, voter_id, participant_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [voteData.battle_id, voteData.voter_id, voteData.participant_id]);
    return result.rows[0] as Vote;
  }

  async getUserVoteForBattle(voterId: string, battleId: string): Promise<Vote | undefined> {
    const result = await pool.query(
      'SELECT * FROM votes WHERE voter_id = $1 AND battle_id = $2',
      [voterId, battleId]
    );
    return result.rows[0] as Vote;
  }

  // Post operations
  async getPosts(limit = 50, offset = 0): Promise<Post[]> {
    const result = await pool.query(`
      SELECT * FROM posts 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows as Post[];
  }

  async createPost(postData: InsertPost): Promise<Post> {
    const result = await pool.query(`
      INSERT INTO posts (author_id, content, image_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [postData.author_id, postData.content || null, postData.image_url || null]);
    return result.rows[0] as Post;
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    const result = await pool.query(`
      SELECT * FROM posts 
      WHERE author_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    return result.rows as Post[];
  }

  // Like operations
  async createLike(likeData: InsertLike): Promise<Like> {
    const result = await pool.query(`
      INSERT INTO likes (user_id, post_id)
      VALUES ($1, $2)
      RETURNING *
    `, [likeData.user_id, likeData.post_id]);
    return result.rows[0] as Like;
  }

  async deleteLike(userId: string, postId: string): Promise<void> {
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
  }

  // Comment operations
  async getComments(battleId: string): Promise<Comment[]> {
    const result = await pool.query(`
      SELECT * FROM comments 
      WHERE battle_id = $1 
      ORDER BY created_at ASC
    `, [battleId]);
    return result.rows as Comment[];
  }

  async createComment(commentData: InsertComment): Promise<Comment> {
    const result = await pool.query(`
      INSERT INTO comments (author_id, battle_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [commentData.author_id, commentData.battle_id, commentData.content]);
    return result.rows[0] as Comment;
  }

  // Follow operations
  async followUser(followerId: string, followingId: string): Promise<void> {
    await pool.query(`
      INSERT INTO follows (follower_id, following_id) 
      VALUES ($1, $2) 
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `, [followerId, followingId]);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
  }

  async getUserFollowers(userId: string): Promise<any[]> {
    const result = await pool.query(`
      SELECT f.*, u.* FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
    `, [userId]);
    return result.rows;
  }

  async getUserFollowing(userId: string): Promise<any[]> {
    const result = await pool.query(`
      SELECT f.*, u.* FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
    `, [userId]);
    return result.rows;
  }

  // Message operations
  async getConversationMessages(userId: string, otherUserId: string): Promise<Message[]> {
    const result = await pool.query(`
      SELECT * FROM messages 
      WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
    `, [userId, otherUserId]);
    return result.rows as Message[];
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content, read_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      messageData.sender_id,
      messageData.receiver_id,
      messageData.content,
      messageData.read_at || null
    ]);
    return result.rows[0] as Message;
  }

  // Notification operations
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const result = await pool.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    return result.rows as Notification[];
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const result = await pool.query(`
      INSERT INTO notifications (user_id, type, title, message, data, read_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      notificationData.user_id,
      notificationData.type,
      notificationData.title,
      notificationData.message || null,
      notificationData.data ? JSON.stringify(notificationData.data) : null,
      notificationData.read_at || null
    ]);
    return result.rows[0] as Notification;
  }

  // OTP operations
  async createOTP(otpData: InsertOtp): Promise<Otp> {
    const result = await pool.query(`
      INSERT INTO otps (email, code, type, expires_at, used)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      otpData.email,
      otpData.code,
      otpData.type,
      otpData.expires_at,
      otpData.used || false
    ]);
    return result.rows[0] as Otp;
  }

  async verifyOTP(otpData: VerifyOtp): Promise<Otp | null> {
    const result = await pool.query(`
      SELECT * FROM otps 
      WHERE email = $1 AND code = $2 AND type = $3 AND used = false AND expires_at > NOW()
    `, [otpData.email, otpData.code, otpData.type]);
    return result.rows[0] as Otp;
  }

  async markOTPAsUsed(otpId: string): Promise<void> {
    await pool.query('UPDATE otps SET used = true WHERE id = $1', [otpId]);
  }

  async cleanupExpiredOTPs(): Promise<void> {
    await pool.query('DELETE FROM otps WHERE expires_at < NOW()');
  }

  // Stats operations
  async getUserStats(userId: string): Promise<any> {
    const [battlesResult, postsResult, followersResult, followingResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM battles WHERE creator_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM posts WHERE author_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM follows WHERE following_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as count FROM follows WHERE follower_id = $1', [userId])
    ]);

    return {
      battlesCreated: parseInt(battlesResult.rows[0].count),
      postsCreated: parseInt(postsResult.rows[0].count),
      followersCount: parseInt(followersResult.rows[0].count),
      followingCount: parseInt(followingResult.rows[0].count)
    };
  }

  async getTopUsers(limit = 50): Promise<any[]> {
    const result = await pool.query(`
      SELECT u.*, COUNT(f.id) as followers_count
      FROM users u
      LEFT JOIN follows f ON u.id = f.following_id
      GROUP BY u.id
      ORDER BY followers_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  async getUserRanking(userId: string): Promise<number> {
    const result = await pool.query(`
      SELECT u.id, COUNT(f.id) as followers_count
      FROM users u
      LEFT JOIN follows f ON u.id = f.following_id
      GROUP BY u.id
      ORDER BY followers_count DESC
    `);
    
    const userIndex = result.rows.findIndex(user => user.id === userId);
    return userIndex !== -1 ? userIndex + 1 : 0;
  }

  // Additional methods for compatibility
  async updateUserProfile(id: string, data: Partial<User>): Promise<User> {
    return this.updateUser(id, data);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    return result.rows.length > 0;
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
    const result = await pool.query(`
      SELECT participant_id, COUNT(*) as count
      FROM votes
      WHERE battle_id = $1
      GROUP BY participant_id
    `, [battleId]);
    return result.rows;
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

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    await pool.query(`
      UPDATE messages 
      SET read_at = NOW() 
      WHERE receiver_id = $1 AND sender_id = $2
    `, [userId, otherUserId]);
  }

  async sendMessage(messageData: InsertMessage): Promise<Message> {
    return this.createMessage(messageData);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = $1', [notificationId]);
  }

  async getActiveBattles(): Promise<Battle[]> {
    const result = await pool.query(`
      SELECT * FROM battles 
      WHERE status = 'active' 
      ORDER BY created_at DESC
    `);
    return result.rows as Battle[];
  }
}

export const storage = new PostgresStorage();
