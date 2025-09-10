// Database types for Supabase

export interface User {
  id: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  username?: string;
  phone?: string;
  country_code?: string;
  bio?: string;
  external_link?: string;
  is_private: boolean;
  verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsertUser {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  username?: string;
  phone?: string;
  country_code?: string;
  bio?: string;
  external_link?: string;
  is_private?: boolean;
  verified?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
}

export interface Battle {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'active' | 'ended' | 'cancelled' | 'expired';
  winner_id?: string;
  created_at: string;
  updated_at: string;
  visibility?: string;
}

export interface InsertBattle {
  creator_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status?: 'active' | 'ended' | 'cancelled';
  winner_id?: string;
}

export interface BattleParticipant {
  id: string;
  battle_id: string;
  user_id: string;
  photo_url: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface InsertBattleParticipant {
  battle_id: string;
  user_id: string;
  photo_url: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface Vote {
  id: string;
  battle_id: string;
  voter_id: string;
  participant_id: string;
  created_at: string;
}

export interface InsertVote {
  battle_id: string;
  voter_id: string;
  participant_id: string;
}

export interface Post {
  id: string;
  author_id: string;
  content?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InsertPost {
  author_id: string;
  content?: string;
  image_url?: string;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface InsertLike {
  user_id: string;
  post_id: string;
}

export interface Comment {
  id: string;
  author_id: string;
  battle_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface InsertComment {
  author_id: string;
  battle_id: string;
  content: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface InsertFollow {
  follower_id: string;
  following_id: string;
}

export interface CloseFriend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

export interface InsertCloseFriend {
  user_id: string;
  friend_id: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at?: string;
  created_at: string;
}

export interface InsertMessage {
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  data?: any;
  read_at?: string;
  created_at: string;
  read: boolean;
}

export interface InsertNotification {
  user_id: string;
  type: string;
  title: string;
  message?: string;
  data?: any;
  read_at?: string;
}

export interface Otp {
  id: string;
  email?: string;
  phone?: string;
  country_code?: string;
  code: string;
  type: 'email_verification' | 'password_reset' | 'phone_verification';
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface InsertOtp {
  email?: string;
  phone?: string;
  country_code?: string;
  code: string;
  type: 'email_verification' | 'password_reset' | 'phone_verification';
  expires_at: string;
  used?: boolean;
}

export interface VerifyOtp {
  email?: string;
  phone?: string;
  country_code?: string;
  code: string;
  type: 'email_verification' | 'password_reset' | 'phone_verification';
}

// Extended types for UI
export interface UserStats {
  battlesCreated: number;
  postsCreated: number;
  followersCount: number;
  followingCount: number;
  // Additional properties expected by frontend
  postsCount: number;
  battlesCount: number;
  battlesWon: number;
  battlesTotal: number;
  winRate: number;
}

export interface BattleWithParticipants {
  battle: Battle;
  participants: Array<{ participant: BattleParticipant; user: User; }>;
  comments?: CommentWithAuthor[];
  userVote?: Vote;
  votes?: Vote[];
}

export interface CommentWithAuthor {
  comment: Comment;
  author: User;
}

export interface PostWithAuthor {
  post: Post;
  author: User;
  likes: number;
  userLiked: boolean;
  isLiked: boolean;
}

export interface FeedItem {
  type: 'battle' | 'post';
  id: string;
  data: BattleWithParticipants | PostWithAuthor;
  created_at: string;
  battle?: BattleWithParticipants;
  post?: PostWithAuthor;
}

export interface NotificationWithData extends Notification {
  data: any;
}
