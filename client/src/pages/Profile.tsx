import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import PostCard from "@/components/PostCard";
import type { User, UserStats, Battle, Post, PostWithAuthor } from "@/types";

export default function Profile() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"battles" | "posts">("battles");
  const [battleFilter, setBattleFilter] = useState<"all" | "wins" | "losses">("all");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Get user stats from the profile endpoint
  const { data: userStats } = useQuery<UserStats>({
    queryKey: ['/api/auth/profile'],
    enabled: isAuthenticated,
    retry: false,
    select: (data) => ({
      postsCreated: 0,
      battlesCreated: 0,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      battlesCount: 0,
      battlesWon: 0,
      battlesTotal: 0,
      winRate: 0,
    }),
  });

  const { data: userBattles } = useQuery<Battle[]>({
    queryKey: ['/api/battles/user', user?.id],
    enabled: isAuthenticated && !!user?.id,
    retry: false,
  });

  const { data: userPosts } = useQuery<PostWithAuthor[]>({
    queryKey: ['/api/posts/user', user?.id],
    enabled: isAuthenticated && !!user?.id,
    retry: false,
  });

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 animate-pulse">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-20 h-20 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="text-center space-y-1">
                  <div className="h-6 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const stats: UserStats = userStats || {
    postsCreated: 0,
    battlesCreated: 0,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    battlesCount: 0,
    battlesWon: 0,
    battlesTotal: 0,
    winRate: 0,
  };
  const battles: Battle[] = userBattles || [];
  const posts: PostWithAuthor[] = userPosts || [];

  const filteredBattles = battles.filter((battle: Battle) => {
    if (battleFilter === "wins") return battle.winner_id === user.id;
    if (battleFilter === "losses") return battle.status === "expired" && battle.winner_id !== user.id;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    
    if (weeks > 0) return `${weeks}w ago`;
    if (days > 0) return `${days}d ago`;
    return "Today";
  };

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-lg font-bold">@{user.username}</span>
          <button className="p-2 text-muted-foreground" data-testid="settings-button">
            <i className="fas fa-cog text-xl" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 px-4 space-y-6">
        {/* Profile Header */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="profile-header">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <img
                src={user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt="Your profile"
                className="w-20 h-20 rounded-full border-4 border-primary"
                data-testid="profile-avatar"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold" data-testid="display-name">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.username}
                  </h2>
                  {user.verified && (
                    <i className="fas fa-check-circle text-primary" data-testid="verified-badge" />
                  )}
                </div>
                <p className="text-muted-foreground" data-testid="username">@{user.username}</p>
              </div>
            </div>
          </div>
          
          {user.bio && (
            <p className="text-sm mb-4" data-testid="user-bio">{user.bio}</p>
          )}
          
          {user.externalLink && (
            <a 
              href={user.externalLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mb-4 block"
              data-testid="external-link"
            >
              🔗 {user.externalLink}
            </a>
          )}
          
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold" data-testid="posts-count">{stats.postsCount || 0}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold" data-testid="battles-count">{stats.battlesCount || 0}</p>
              <p className="text-xs text-muted-foreground">Battles</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold" data-testid="followers-count">{stats.followersCount || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold" data-testid="following-count">{stats.followingCount || 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-accent" data-testid="win-rate">{stats.winRate || 0}%</p>
              <p className="text-xs text-muted-foreground">W/L</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium" data-testid="edit-profile">
              Edit Profile
            </button>
            <button className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-lg font-medium" data-testid="share-profile">
              Share Profile
            </button>
          </div>
        </div>
        
        {/* Profile Tabs */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("battles")}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === "battles"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
              data-testid="battles-tab"
            >
              Battle History
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === "posts"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
              data-testid="posts-tab"
            >
              Posts
            </button>
          </div>
          
          <div className="p-4">
            {activeTab === "battles" ? (
              <div className="space-y-3">
                {/* Filter Pills */}
                <div className="flex space-x-2 mb-4">
                  <button
                    onClick={() => setBattleFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs ${
                      battleFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid="filter-all"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setBattleFilter("wins")}
                    className={`px-3 py-1 rounded-full text-xs ${
                      battleFilter === "wins"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid="filter-wins"
                  >
                    Wins
                  </button>
                  <button
                    onClick={() => setBattleFilter("losses")}
                    className={`px-3 py-1 rounded-full text-xs ${
                      battleFilter === "losses"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid="filter-losses"
                  >
                    Losses
                  </button>
                </div>
                
                {/* Battle History Items */}
                {filteredBattles.length > 0 ? (
                  filteredBattles.map((battle: Battle) => {
                    const isWin = battle.winner_id === user.id;
                    const isExpired = battle.status === "expired";
                    
                    return (
                      <div
                        key={battle.id}
                        className="flex items-center space-x-3 p-3 bg-background rounded-lg"
                        data-testid={`battle-history-${battle.id}`}
                      >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          !isExpired ? "bg-yellow-500/20" :
                          isWin ? "bg-green-500/20" : "bg-red-500/20"
                        }`}>
                          <i className={`${
                            !isExpired ? "fas fa-clock text-yellow-400" :
                            isWin ? "fas fa-trophy text-green-400" : "fas fa-times text-red-400"
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">
                              {battle.title || `Battle ${battle.id.slice(-8)}`}
                            </p>
                            {isExpired && (
                              <span className={`text-sm font-medium ${
                                isWin ? "text-green-400" : "text-red-400"
                              }`}>
                                {isWin ? "Won" : "Lost"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {battle.visibility} • {formatDate(battle.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <i className="fas fa-sword text-3xl mb-3 block" />
                    <h3 className="text-lg font-semibold mb-2">No battles yet</h3>
                    <p className="text-sm">Start creating battles to see your history here</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {posts.length > 0 ? (
                  posts.map((postWithAuthor: PostWithAuthor) => (
                    <PostCard
                      key={postWithAuthor.post.id}
                      post={postWithAuthor.post}
                      author={postWithAuthor.author}
                      isLiked={postWithAuthor.isLiked}
                    />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <i className="fas fa-image text-3xl mb-3 block" />
                    <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                    <p className="text-sm">Share your first post to get started</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
