import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UserCardProps {
  user: any;
  rank?: number;
  isFollowing?: boolean;
  showStats?: boolean;
}

export default function UserCard({ user, rank, isFollowing: initialIsFollowing, showStats = true }: UserCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await apiRequest("DELETE", `/api/users/${user.id}/follow`);
      } else {
        await apiRequest("POST", `/api/users/${user.id}/follow`);
      }
    },
    onSuccess: () => {
      setIsFollowing(!isFollowing);
      queryClient.invalidateQueries({ queryKey: ['/api/ranking'] });
      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: `You ${isFollowing ? "unfollowed" : "are now following"} @${user.username}`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update follow status. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center space-x-4 p-4 bg-card rounded-lg border border-border" data-testid={`user-card-${user.id}`}>
      {rank && (
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
          rank === 1 ? "bg-accent text-background" : "bg-muted text-foreground"
        }`} data-testid="user-rank">
          {rank}
        </div>
      )}
      
      <img
        src={user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
        alt={user.username}
        className="w-12 h-12 rounded-full"
        data-testid="user-avatar"
      />
      
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <p className="font-semibold" data-testid="user-username">@{user.username}</p>
          {user.verified && (
            <i className="fas fa-check-circle text-primary text-sm" data-testid="verified-badge" />
          )}
        </div>
        {showStats && (
          <div className="flex space-x-4 text-sm text-muted-foreground">
            <span data-testid="user-wins">{user.battlesWon || 0} wins</span>
            <span data-testid="user-win-rate">{user.winRate || 0}% W/L</span>
          </div>
        )}
        {user.bio && !showStats && (
          <p className="text-sm text-muted-foreground truncate" data-testid="user-bio">{user.bio}</p>
        )}
      </div>
      
      <button
        onClick={() => followMutation.mutate()}
        disabled={followMutation.isPending}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          isFollowing
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
        }`}
        data-testid="follow-button"
      >
        {followMutation.isPending ? "..." : isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
