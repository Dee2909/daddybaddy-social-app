import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import BattleCard from "@/components/BattleCard";
import PostCard from "@/components/PostCard";
import { useEffect } from "react";
import type { FeedItem, Notification } from "@/types";

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: feed, isLoading, error, refetch } = useQuery<FeedItem[]>({
    queryKey: ['/api/feed'],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Handle WebSocket messages (only when authenticated)
  useWebSocket(isAuthenticated ? (message) => {
    if (message.type === 'voteUpdate' || message.type === 'battleEnded') {
      refetch();
    }
  } : undefined);

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-24 mb-1" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
              <div className="h-48 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error)) {
    return null; // Redirect will happen in useEffect
  }

  const unreadNotifications = notifications?.filter((n: Notification) => !n.read) || [];

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <i className="fas fa-crown text-white text-sm" />
            </div>
            <span className="text-lg font-bold">DaddyBaddy</span>
          </div>
          <button className="relative p-2" data-testid="notifications-button">
            <i className="fas fa-bell text-xl" />
            {unreadNotifications.length > 0 && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" data-testid="notification-dot" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 px-4 space-y-6" data-testid="home-feed">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-24 mb-1" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                </div>
                <div className="h-48 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        ) : feed && Array.isArray(feed) && feed.length > 0 ? (
          <div className="space-y-6">
            {feed.map((item: any) => {
              // Handle battle items
              if (item.type === 'battle' || item.battle) {
                const battleData = item.battle || item;
                return (
                  <BattleCard
                    key={`battle-${battleData.battle?.id || battleData.id}`}
                    battle={battleData.battle || battleData}
                    participants={battleData.participants || []}
                    userVote={battleData.userVote}
                    onVote={() => refetch()}
                  />
                );
              } 
              // Handle post items
              else if (item.type === 'post' || item.post) {
                const postData = item.post || item;
                return (
                  <PostCard
                    key={`post-${postData.post?.id || postData.id}`}
                    post={postData.post || postData}
                    author={postData.author}
                    isLiked={postData.isLiked || postData.userLiked}
                  />
                );
              }
              return null;
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16">
            <i className="fas fa-infinity text-4xl mb-4 block" />
            <h3 className="text-lg font-semibold mb-2">No content yet</h3>
            <p className="text-sm">Start following users or create your first battle!</p>
          </div>
        )}
      </main>
    </div>
  );
}
