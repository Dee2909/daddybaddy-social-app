import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./supabaseStorage";
import { isAuthenticated, setupSession } from "./auth";
import authRoutes from "./authRoutes";
// Note: Schema validation will be handled by Supabase RLS and manual validation
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple session middleware for development
  app.use(setupSession);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authentication routes
  console.log('Registering auth routes...');
  app.use('/api/auth', authRoutes);
  console.log('Auth routes registered');

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes
  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      const currentUserId = req.user.id;
      if (!q) {
        return res.json([]);
      }
      const users = await storage.searchUsers(q as string, currentUserId);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get('/api/users/:username', isAuthenticated, async (req: any, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const stats = await storage.getUserStats(user.id);
      res.json({ ...user, ...stats });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/users/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const updatedUser = await storage.updateUserProfile(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Follow routes
  app.post('/api/users/:userId/follow', isAuthenticated, async (req: any, res) => {
    try {
      const followerId = req.user.id;
      const { userId } = req.params;
      await storage.followUser(followerId, userId);
      await storage.createNotification({
        user_id: userId,
        type: "follow",
        title: "New Follower",
        message: `@${req.user.id} started following you`,
        data: { followerId }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete('/api/users/:userId/follow', isAuthenticated, async (req: any, res) => {
    try {
      const followerId = req.user.id;
      const { userId } = req.params;
      await storage.unfollowUser(followerId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get('/api/users/:userId/following-status', isAuthenticated, async (req: any, res) => {
    try {
      const followerId = req.user.id;
      const { userId } = req.params;
      const isFollowing = await storage.isFollowing(followerId, userId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // Battle routes
  app.post('/api/battles', isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      const creatorId = req.user.id;
      const { participants, ...battleData } = req.body;
      
      // Basic validation - add battle data with creator
      const battle = await storage.createBattle({
        creator_id: creatorId,
        ...battleData
      });
      
      // Add creator as participant if photo was uploaded
      if (req.file) {
        const photoUrl = `/uploads/${req.file.filename}`;
        await storage.addBattleParticipant({
          battle_id: battle.id,
          user_id: creatorId,
          photo_url: photoUrl,
          status: 'accepted',
        });
      }
      
      // Add invited participants
      if (participants) {
        const participantIds = JSON.parse(participants);
        for (const userId of participantIds) {
          await storage.addBattleParticipant({
            battle_id: battle.id,
            user_id: userId,
            photo_url: '', // Will be set when they accept
            status: 'pending',
          });
          await storage.createNotification({
            user_id: userId,
            type: "battle_invite",
            title: "Battle Invitation",
            message: `You've been invited to a battle by @${req.user.id}`,
            data: { battleId: battle.id }
          });
        }
      }
      
      res.json(battle);
    } catch (error) {
      console.error("Error creating battle:", error);
      res.status(500).json({ message: "Failed to create battle" });
    }
  });

  app.get('/api/battles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const battle = await storage.getBattle(id);
      if (!battle) {
        return res.status(404).json({ message: "Battle not found" });
      }
      
      const participants = await storage.getBattleParticipants(id);
      const comments = await storage.getBattleComments(id);
      const userVote = await storage.getUserVoteForBattle(req.user.id, id);
      const votes = await storage.getVotes(id);
      
      // Get user data for each participant
      const participantsWithUsers = await Promise.all(
        participants.map(async (participant) => {
          const user = await storage.getUser(participant.user_id);
          return { participant, user };
        })
      );
      
      // Get author data for each comment
      const commentsWithAuthors = await Promise.all(
        comments.map(async (comment) => {
          const author = await storage.getUser(comment.author_id);
          return { comment, author };
        })
      );
      
      res.json({
        battle,
        participants: participantsWithUsers,
        comments: commentsWithAuthors,
        userVote,
        votes,
      });
    } catch (error) {
      console.error("Error fetching battle:", error);
      res.status(500).json({ message: "Failed to fetch battle" });
    }
  });

  app.post('/api/battles/:id/accept', isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ message: "Photo is required" });
      }
      
      const photoUrl = `/uploads/${req.file.filename}`;
      // Find the participant record and update it
      const participants = await storage.getBattleParticipants(id);
      const participant = participants.find(p => p.user_id === userId);
      if (!participant) {
        return res.status(404).json({ message: "Battle invitation not found" });
      }
      
      await storage.updateBattleParticipant(participant.id, {
        photo_url: photoUrl,
        status: 'accepted'
      });
      
      // Check if battle should be activated (at least one participant accepted)
      const updatedParticipants = await storage.getBattleParticipants(id);
      const acceptedParticipants = updatedParticipants.filter(p => p.status === 'accepted');
      
      if (acceptedParticipants.length >= 2) {
        await storage.updateBattleStatus(id, "active");
        
        // Notify all participants that battle has started
        for (const p of acceptedParticipants) {
          await storage.createNotification({
            user_id: p.user_id,
            type: "battle_start",
            title: "Battle Started",
            message: "Your battle has begun! Voting is now open.",
            data: { battleId: id }
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error accepting battle:", error);
      res.status(500).json({ message: "Failed to accept battle" });
    }
  });

  app.post('/api/battles/:id/vote', isAuthenticated, async (req: any, res) => {
    try {
      const voterId = req.user.id;
      const { id } = req.params;
      const { participantId } = req.body;
      
      // Basic validation
      if (!participantId) {
        return res.status(400).json({ message: "Participant ID is required" });
      }
      
      await storage.castVote({
        battle_id: id,
        voter_id: voterId,
        participant_id: participantId,
      });
      
      // Update vote counts
      const voteCounts = await storage.getBattleVoteCounts(id);
      const totalVotes = voteCounts.reduce((sum: number, vc: any) => sum + parseInt(vc.count), 0);
      
      for (const voteCount of voteCounts) {
        const count = parseInt(voteCount.count);
        await storage.updateParticipantVoteCount(voteCount.participant_id, count);
      }
      
      // Broadcast vote update via WebSocket
      if (wss) {
        const updateData = {
          type: 'voteUpdate',
          battleId: id,
          voteCounts: voteCounts.map((vc: any) => ({
            participantId: vc.participant_id,
            voteCount: parseInt(vc.count),
            percentage: totalVotes > 0 ? Math.round((parseInt(vc.count) / totalVotes) * 100) : 0,
          })),
          totalVotes,
        };
        
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(updateData));
          }
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error casting vote:", error);
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  // Feed routes
  app.get('/api/feed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const battles = await storage.getBattleFeed();
      const posts = await storage.getPostsFeed();
      
      // Combine and sort by creation date
      const feed = [...battles, ...posts].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      res.json(feed);
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // Post routes
  app.post('/api/posts', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const authorId = req.user.id;
      const postData = { ...req.body };
      
      if (req.file) {
        postData.imageUrl = `/uploads/${req.file.filename}`;
      }
      
      // Basic validation
      const post = await storage.createPost({
        author_id: authorId,
        content: postData.content,
        image_url: postData.imageUrl,
      });
      res.json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.post('/api/posts/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await storage.likePost(userId, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  app.delete('/api/posts/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await storage.unlikePost(userId, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unliking post:", error);
      res.status(500).json({ message: "Failed to unlike post" });
    }
  });

  // Comment routes
  app.post('/api/comments', isAuthenticated, async (req: any, res) => {
    try {
      const authorId = req.user.id;
      // Basic validation
      const { battleId, content } = req.body;
      if (!battleId || !content) {
        return res.status(400).json({ message: "Battle ID and content are required" });
      }
      
      const comment = await storage.addComment({
        author_id: authorId,
        battle_id: battleId,
        content,
      });
      res.json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Message routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/conversations/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const { userId } = req.params;
      const messages = await storage.getConversationMessages(currentUserId, userId);
      await storage.markMessagesAsRead(currentUserId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const senderId = req.user.id;
      // Basic validation
      const { receiverId, content } = req.body;
      if (!receiverId || !content) {
        return res.status(400).json({ message: "Receiver ID and content are required" });
      }
      
      const message = await storage.sendMessage({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
      });
      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // User-specific routes
  app.get('/api/battles/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const battles = await storage.getUserBattles(userId);
      res.json(battles);
    } catch (error) {
      console.error("Error fetching user battles:", error);
      res.status(500).json({ message: "Failed to fetch user battles" });
    }
  });

  app.get('/api/posts/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const posts = await storage.getUserPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching user posts:", error);
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  // Ranking routes
  app.get('/api/ranking', isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getTopUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching ranking:", error);
      res.status(500).json({ message: "Failed to fetch ranking" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Create HTTP server and WebSocket server
  const httpServer = createServer(app);
  let wss: WebSocketServer;

  // Set up WebSocket server for real-time updates
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Battle expiration checker (runs every minute)
  setInterval(async () => {
    try {
      const activeBattles = await storage.getActiveBattles();
      
      for (const battle of activeBattles) {
        if (new Date() > new Date(battle.end_time)) {
          // Determine winner
          const participants = await storage.getBattleParticipants(battle.id);
          const acceptedParticipants = participants.filter(p => p.status === 'accepted');
          
          let winnerId: string | undefined;
          if (acceptedParticipants.length > 0) {
            // Get vote counts for each participant
            const votes = await storage.getVotes(battle.id);
            const participantVotes = participants.map(p => ({
              participant: p,
              voteCount: votes.filter(v => v.participant_id === p.id).length
            }));
            
            const winner = participantVotes.reduce((prev, current) => 
              (prev.voteCount > current.voteCount) ? prev : current
            );
            winnerId = winner.participant.user_id;
          }
          
          await storage.updateBattle(battle.id, { 
            status: "ended", 
            winner_id: winnerId 
          });
          
          // Notify participants
          for (const p of acceptedParticipants) {
            const isWinner = p.user_id === winnerId;
            await storage.createNotification({
              user_id: p.user_id,
              type: "battle_result",
              title: isWinner ? "You Won!" : "Battle Ended",
              message: isWinner ? "Congratulations! You won the battle!" : "Your battle has ended.",
              data: { battleId: battle.id }
            });
          }
          
          // Broadcast battle end via WebSocket
          if (wss) {
            const updateData = {
              type: 'battleEnded',
              battleId: battle.id,
              winnerId,
            };
            
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(updateData));
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking battle expiration:', error);
    }
  }, 60000); // Check every minute

  return httpServer;
}
