// Real-time service for DaddyBaddy app
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

class RealtimeService {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.subscriptions = new Map();
    this.callbacks = new Map();
  }

  // Subscribe to real-time updates for a specific table
  subscribe(table, filter, callback) {
    const subscriptionKey = `${table}_${JSON.stringify(filter)}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey);
    }

    let query = this.supabase
      .channel(`${table}_changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table,
        filter: filter
      }, callback);

    const subscription = query.subscribe();
    this.subscriptions.set(subscriptionKey, subscription);
    this.callbacks.set(subscriptionKey, callback);

    return subscription;
  }

  // Subscribe to battles updates
  subscribeToBattles(callback) {
    return this.subscribe('battles', null, callback);
  }

  // Subscribe to specific battle updates
  subscribeToBattle(battleId, callback) {
    return this.subscribe('battles', `id=eq.${battleId}`, callback);
  }

  // Subscribe to battle votes
  subscribeToBattleVotes(battleId, callback) {
    return this.subscribe('votes', `battle_id=eq.${battleId}`, callback);
  }

  // Subscribe to posts updates
  subscribeToPosts(callback) {
    return this.subscribe('posts', null, callback);
  }

  // Subscribe to specific post updates
  subscribeToPost(postId, callback) {
    return this.subscribe('posts', `id=eq.${postId}`, callback);
  }

  // Subscribe to post likes
  subscribeToPostLikes(postId, callback) {
    return this.subscribe('likes', `post_id=eq.${postId}`, callback);
  }

  // Subscribe to chat messages
  subscribeToChatMessages(chatId, callback) {
    return this.subscribe('messages', `chat_id=eq.${chatId}`, callback);
  }

  // Subscribe to user notifications
  subscribeToNotifications(userId, callback) {
    return this.subscribe('notifications', `user_id=eq.${userId}`, callback);
  }

  // Subscribe to follows updates
  subscribeToFollows(userId, callback) {
    return this.subscribe('follows', `follower_id=eq.${userId}`, callback);
  }

  // Unsubscribe from a specific subscription
  unsubscribe(subscriptionKey) {
    if (this.subscriptions.has(subscriptionKey)) {
      this.supabase.removeChannel(this.subscriptions.get(subscriptionKey));
      this.subscriptions.delete(subscriptionKey);
      this.callbacks.delete(subscriptionKey);
    }
  }

  // Unsubscribe from all subscriptions
  unsubscribeAll() {
    this.subscriptions.forEach((subscription, key) => {
      this.supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
    this.callbacks.clear();
  }

  // Get real-time connection status
  getConnectionStatus() {
    return this.supabase.getChannels().length > 0;
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;

