import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import BattleCard from "@/components/BattleCard";
import type { BattleWithParticipants } from "@/types";

interface BattleDetailProps {
  battleId: string;
  onBack: () => void;
}

export default function BattleDetail({ battleId, onBack }: BattleDetailProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: battleData, isLoading, error, refetch } = useQuery<BattleWithParticipants>({
    queryKey: ['/api/battles', battleId],
    enabled: isAuthenticated && !!battleId,
    retry: false,
  });

  // Handle WebSocket messages for real-time updates (only when authenticated)
  useWebSocket(isAuthenticated ? (message) => {
    if (message.type === 'voteUpdate' && message.battleId === battleId) {
      refetch();
    }
    if (message.type === 'battleEnded' && message.battleId === battleId) {
      refetch();
      toast({
        title: "Battle Ended",
        description: "This battle has finished!",
      });
    }
  } : undefined);

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4">
          <div className="bg-card rounded-lg border border-border p-4 animate-pulse">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-24 mb-1" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="h-48 bg-muted rounded-lg" />
              <div className="h-48 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error)) {
    return null; // Redirect will happen in useEffect
  }

  if (!battleData) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen relative">
        <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="flex items-center px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 text-muted-foreground mr-2"
              data-testid="back-button"
            >
              <i className="fas fa-arrow-left" />
            </button>
            <h1 className="text-lg font-bold">Battle Detail</h1>
          </div>
        </header>
        
        <main className="pt-16 pb-20 px-4 flex items-center justify-center min-h-screen">
          <div className="text-center text-muted-foreground">
            <i className="fas fa-exclamation-triangle text-4xl mb-4 block" />
            <h3 className="text-lg font-semibold mb-2">Battle not found</h3>
            <p className="text-sm">This battle may have been deleted or you don't have access to it.</p>
          </div>
        </main>
      </div>
    );
  }

  const { battle, participants, comments, userVote, votes } = battleData;

  const getTimeLeft = () => {
    if (battle.status !== "active" || !battle.end_time) return null;
    
    const now = new Date();
    const expires = new Date(battle.end_time);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  const getStatusInfo = () => {
    switch (battle.status) {
      case "active":
        return {
          text: getTimeLeft() || "Battle in progress",
          color: "text-green-400",
          icon: "fas fa-play"
        };
      case "ended":
        const winner = participants.find((p) => p.user?.id === battle.winner_id);
        return {
          text: winner ? `Winner: @${winner.user.username}` : "Battle ended",
          color: "text-accent",
          icon: "fas fa-trophy"
        };
      case "cancelled":
        return {
          text: "Battle cancelled",
          color: "text-red-400",
          icon: "fas fa-times"
        };
      default:
        return {
          text: "Unknown status",
          color: "text-muted-foreground",
          icon: "fas fa-question"
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 text-muted-foreground mr-2"
            data-testid="back-button"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <h1 className="text-lg font-bold">Battle Detail</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 px-4 space-y-6">
        {/* Status Strip */}
        <div className="bg-card rounded-lg border border-border p-4" data-testid="battle-status">
          <div className="flex items-center justify-center space-x-2">
            <i className={`${statusInfo.icon} ${statusInfo.color}`} />
            <span className={`font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
        </div>

        {/* Battle Card */}
        {isLoading ? (
          <div className="bg-card rounded-lg border border-border p-4 animate-pulse">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="h-48 bg-muted rounded-lg" />
              <div className="h-48 bg-muted rounded-lg" />
            </div>
          </div>
        ) : (
          <BattleCard
            battle={battle}
            participants={participants}
            userVote={userVote}
            onVote={() => refetch()}
          />
        )}

        {/* Participants List */}
        <div className="bg-card rounded-lg border border-border p-4" data-testid="participants-list">
          <h3 className="text-lg font-semibold mb-4">Participants</h3>
          <div className="space-y-3">
            {participants.map((participant, index: number) => {
              // Calculate vote counts from votes data
              const participantVotes = votes?.filter((vote: any) => vote.participant_id === participant.participant.id).length || 0;
              const totalVotes = votes?.length || 0;
              const votePercentage = totalVotes > 0 ? Math.round((participantVotes / totalVotes) * 100) : 0;
              const isLeading = participantVotes > 0 && 
                participants.every((p) => {
                  const pVotes = votes?.filter((vote: any) => vote.participant_id === p.participant.id).length || 0;
                  return pVotes <= participantVotes;
                });
              
              return (
                <div
                  key={participant.participant.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg ${
                    isLeading && battle.status === "active" ? "bg-accent/10 border border-accent/20" : "bg-background"
                  }`}
                  data-testid={`participant-${participant.participant.id}`}
                >
                  <img
                    src={participant.user?.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.user?.username}`}
                    alt={participant.user?.username}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">@{participant.user?.username}</p>
                      <div className="text-right">
                        <p className="font-bold text-accent">
                          {votePercentage}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {participantVotes} votes
                        </p>
                      </div>
                    </div>
                    {isLeading && battle.status === "active" && (
                      <p className="text-xs text-accent font-medium">Currently leading</p>
                    )}
                    {userVote?.participant_id === participant.participant.id && (
                      <p className="text-xs text-primary font-medium">Your vote</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        {battle.status === "ended" && (
          <div className="flex space-x-3">
            <button className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium" data-testid="rematch-button">
              <i className="fas fa-redo mr-2" />
              Rematch
            </button>
            <button className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-lg font-medium" data-testid="challenge-again-button">
              <i className="fas fa-sword mr-2" />
              Challenge Again
            </button>
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-card rounded-lg border border-border p-4" data-testid="comments-section">
          <h3 className="text-lg font-semibold mb-4">Private Feedback</h3>
          
          {comments && comments.length > 0 ? (
            <div className="space-y-3 mb-4">
              {comments.map((commentWithAuthor) => (
                <div key={commentWithAuthor.comment.id} className="flex items-start space-x-3">
                  <img
                    src={commentWithAuthor.author?.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${commentWithAuthor.author?.username}`}
                    alt={commentWithAuthor.author?.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-sm">@{commentWithAuthor.author?.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(commentWithAuthor.comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm">{commentWithAuthor.comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No feedback yet</p>
          )}
          
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Send private feedback to creator..."
              className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="feedback-input"
            />
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium" data-testid="send-feedback">
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
