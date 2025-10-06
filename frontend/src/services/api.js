// API service for DaddyBaddy app
// Use the same backend base as the app: REACT_APP_BACKEND_URL + /api
const API_BASE_URL = (process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : 'http://127.0.0.1:8001/api');

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Handle authentication error
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // ==================== AUTH ENDPOINTS ====================

  async sendOTP(phone) {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  }

  async verifyOTP(phone, token) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, token })
    });
  }

  async registerWithOTP(userData) {
    return this.request('/auth/register-with-otp', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async login(phone, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
  }

  // ==================== BATTLE ENDPOINTS ====================

  async getBattles(skip = 0, limit = 20, status = null) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    return this.request(`/battles?${params}`);
  }

  async getBattle(battleId) {
    return this.request(`/battles/${battleId}`);
  }

  async createBattle(battleData) {
    return this.request('/battles', {
      method: 'POST',
      body: JSON.stringify(battleData)
    });
  }

  async createUserBattle(data) {
    return this.request('/battles/user', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async acceptBattle(battleId) {
    return this.request(`/battles/${battleId}/accept`, { method: 'POST' });
  }

  async declineBattle(battleId) {
    return this.request(`/battles/${battleId}/decline`, { method: 'POST' });
  }

  async uploadBattleSubmission(battleId, media_url) {
    return this.request(`/battles/${battleId}/upload`, {
      method: 'POST',
      body: JSON.stringify({ media_url })
    });
  }

  async voteBattle(battleId, choice) {
    return this.request(`/battles/${battleId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ choice })
    });
  }

  // ======== Private battle comments ========
  async sendPrivateComment(battleId, content, reactions = []) {
    return this.request(`/battles/${battleId}/private-comments`, {
      method: 'POST',
      body: JSON.stringify({ content, reactions })
    });
  }

  async listPrivateComments(battleId, filter = 'all') {
    const params = new URLSearchParams({ filter });
    return this.request(`/battles/${battleId}/private-comments?${params}`);
  }

  async markPrivateCommentRead(commentId) {
    return this.request(`/private-comments/${commentId}/mark-read`, { method: 'POST' });
  }

  async reportPrivateComment(commentId) {
    return this.request(`/private-comments/${commentId}/report`, { method: 'POST' });
  }

  async deletePrivateComment(commentId) {
    return this.request(`/private-comments/${commentId}`, { method: 'DELETE' });
  }

  // ==================== POST ENDPOINTS ====================

  async getPosts(skip = 0, limit = 20) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    return this.request(`/posts?${params}`);
  }

  async createPost(postData) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async likePost(postId) {
    return this.request(`/posts/${postId}/like`, {
      method: 'POST'
    });
  }

  async replyToPost(postId, replyData) {
    return this.request(`/posts/${postId}/reply`, {
      method: 'POST',
      body: JSON.stringify(replyData)
    });
  }

  async quotePost(postId, quoteData) {
    return this.request(`/posts/${postId}/quote`, {
      method: 'POST',
      body: JSON.stringify(quoteData)
    });
  }

  async repost(postId) {
    return this.request(`/posts/${postId}/repost`, {
      method: 'POST'
    });
  }

  async getPostThread(postId) {
    return this.request(`/posts/${postId}/thread`);
  }

  async getPostQuotes(postId) {
    return this.request(`/posts/${postId}/quotes`);
  }

  async getPostMentions(postId) {
    return this.request(`/posts/${postId}/mentions`);
  }

  async getUserFeed(userId, skip = 0, limit = 20) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    return this.request(`/posts/feed/${userId}?${params}`);
  }

  // ==================== USER ENDPOINTS ====================

  async getUsers(skip = 0, limit = 20, search = null) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (search) params.append('search', search);
    return this.request(`/users?${params}`);
  }

  async getUser(userId) {
    return this.request(`/users/${userId}`);
  }

  async getUserByUsername(username) {
    return this.request(`/users/by-username/${encodeURIComponent(username)}`);
  }

  async getFollowCounts(userId) {
    return this.request(`/users/${userId}/follow_counts`);
  }

  async getFollowers(userId) {
    return this.request(`/users/${userId}/followers`);
  }

  async getFollowing(userId) {
    return this.request(`/users/${userId}/following`);
  }

  async updateProfile(data) {
    return this.request(`/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async followUser(userId) {
    return this.request(`/users/${userId}/follow`, {
      method: 'POST'
    });
  }

  // ==================== CHAT ENDPOINTS ====================

  async getChats() {
    return this.request('/chats');
  }

  async createDirectChat(recipientId) {
    return this.request('/chats/direct', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId })
    });
  }

  async getChatSuggestions(limit = 8) {
    const params = new URLSearchParams({ limit: limit.toString() });
    return this.request(`/chats/suggestions?${params}`);
  }

  async getMessages(chatId, skip = 0, limit = 50) {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    return this.request(`/chats/${chatId}/messages?${params}`);
  }

  async sendMessage(chatId, content) {
    return this.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  // ==================== NOTIFICATION ENDPOINTS ====================

  async getNotifications() {
    return this.request('/notifications');
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST'
    });
  }

  // ==================== SEARCH ENDPOINTS ====================

  async searchUsers(query, skip = 0, limit = 20) {
    return this.getUsers(skip, limit, query);
  }

  async searchBattles(query, skip = 0, limit = 20) {
    // This would need to be implemented in the backend
    const params = new URLSearchParams({ 
      skip: skip.toString(), 
      limit: limit.toString(),
      search: query 
    });
    return this.request(`/battles/search?${params}`);
  }

  async searchPosts(query, skip = 0, limit = 20) {
    // This would need to be implemented in the backend
    const params = new URLSearchParams({ 
      skip: skip.toString(), 
      limit: limit.toString(),
      search: query 
    });
    return this.request(`/posts/search?${params}`);
  }

  // ==================== RANKING ENDPOINTS ====================

  async getRanking(skip = 0, limit = 20) {
    // This would need to be implemented in the backend
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    return this.request(`/ranking?${params}`);
  }

  async getLeaderboard(skip = 0, limit = 20, timeFilter = 'weekly') {
    // This would need to be implemented in the backend
    const params = new URLSearchParams({ 
      skip: skip.toString(), 
      limit: limit.toString(),
      time_filter: timeFilter 
    });
    return this.request(`/leaderboard?${params}`);
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
