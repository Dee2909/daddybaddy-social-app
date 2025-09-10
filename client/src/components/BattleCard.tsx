import { useState, memo, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { 
  getAriaLabelForBattleStatus, 
  getAriaLabelForVoteButton, 
  getAriaLabelForParticipant,
  getAriaLabelForTimeLeft,
  getAriaLabelForButton,
  getAriaLabelForVoteMeter
} from "@/lib/accessibility";

interface BattleCardProps {
  battle: any;
  participants: any[];
  userVote?: any;
  onVote?: (participantId: string) => void;
}

const BattleCard = memo(function BattleCard({ battle, participants, userVote, onVote }: BattleCardProps) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const queryClient = useQueryClient();
  const [votedParticipant, setVotedParticipant] = useState(userVote?.participantId);

  const voteMutation = useMutation({
    mutationFn: async (participantId: string) => {
      await apiRequest("POST", `/api/battles/${battle.id}/vote`, { participantId });
    },
    onSuccess: (_, participantId) => {
      setVotedParticipant(participantId);
      onVote?.(participantId);
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      toast({
        title: "Vote cast!",
        description: "Your vote has been recorded.",
      });
    },
    onError: (error) => {
      handleError(error, "voting");
    },
  });

  const handlePhotoClick = useCallback((participantId: string) => {
    if (battle.status !== "active" || voteMutation.isPending) return;
    voteMutation.mutate(participantId);
  }, [battle.status, voteMutation]);

  const getTimeLeft = useCallback(() => {
    if (battle.status !== "active" || !battle.expiresAt) return null;
    
    const now = new Date();
    const expires = new Date(battle.expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  }, [battle.status, battle.expiresAt]);

  const getStatusBadge = useCallback(() => {
    switch (battle.status) {
      case "pending":
        return <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Pending</span>;
      case "active":
        return <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Ongoing</span>;
      case "expired":
        return <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full">Expired</span>;
      default:
        return null;
    }
  }, [battle.status]);

  const acceptedParticipants = useMemo(() => 
    participants.filter(p => p.participant.accepted), 
    [participants]
  );
  
  const totalVotes = useMemo(() => 
    acceptedParticipants.reduce((sum, p) => sum + p.participant.voteCount, 0),
    [acceptedParticipants]
  );

  return (
    <article 
      className="bg-card rounded-lg border border-border overflow-hidden" 
      data-testid={`battle-card-${battle.id}`}
      aria-label={`Battle: ${battle.title || 'Untitled battle'}`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2" role="group" aria-label="Battle participants">
              {participants.slice(0, 3).map((p, index) => (
                <img
                  key={index}
                  src={p.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user?.username}`}
                  alt={p.user?.username || `Participant ${index + 1}`}
                  className="w-8 h-8 rounded-full border-2 border-background"
                />
              ))}
            </div>
            <span className="text-sm font-medium">
              {participants.map(p => `@${p.user?.username}`).join(' vs ')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span 
              className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full capitalize"
              aria-label={`Visibility: ${battle.visibility}`}
            >
              {battle.visibility}
            </span>
            <span aria-label={getAriaLabelForBattleStatus(battle.status)}>
              {getStatusBadge()}
            </span>
          </div>
        </div>

        {/* Battle Photos Grid */}
        {battle.status === "pending" ? (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {acceptedParticipants.map((p) => (
              <img
                key={p.participant.id}
                src={p.participant.photoUrl}
                alt={`${p.user?.username}'s photo`}
                className="w-full h-48 object-cover rounded-lg"
              />
            ))}
            {Array.from({ length: 2 - acceptedParticipants.length }).map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground"
              >
                <i className="fas fa-clock text-2xl mb-2" />
                <span className="text-xs text-center">
                  Waiting for<br />opponent
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {acceptedParticipants.map((p) => (
              <button
                key={p.participant.id}
                className={cn(
                  "relative cursor-pointer transition-all duration-200 w-full",
                  battle.status === "active" && "hover:scale-[1.02]",
                  votedParticipant === p.participant.id && "ring-2 ring-accent scale-[1.02]"
                )}
                onClick={() => handlePhotoClick(p.participant.id)}
                data-testid={`battle-photo-${p.participant.id}`}
                disabled={battle.status !== "active" || voteMutation.isPending}
                aria-label={getAriaLabelForParticipant(p, false, votedParticipant === p.participant.id)}
                aria-pressed={votedParticipant === p.participant.id}
              >
                <img
                  src={p.participant.photoUrl}
                  alt={`${p.user?.username}'s photo`}
                  className="w-full h-48 object-cover rounded-lg"
                />
                {battle.status === "active" && (
                  <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <i className="fas fa-check-circle text-accent text-2xl" aria-hidden="true" />
                  </div>
                )}
                {votedParticipant === p.participant.id && (
                  <div className="absolute top-2 right-2 bg-accent text-background rounded-full w-6 h-6 flex items-center justify-center">
                    <i className="fas fa-check text-xs" aria-hidden="true" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Vote Meters */}
        {battle.status !== "pending" && acceptedParticipants.length > 0 && (
          <div className="space-y-2 mb-4" role="group" aria-label="Vote results">
            {acceptedParticipants.map((p) => (
              <div key={p.participant.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">@{p.user?.username}</span>
                  <span className="font-medium text-accent">
                    {p.participant.votePercentage || 0}%
                  </span>
                </div>
                <div 
                  className="w-full bg-muted rounded-full h-2"
                  role="progressbar"
                  aria-label={getAriaLabelForVoteMeter(p)}
                  aria-valuenow={p.participant.votePercentage || 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-gradient-to-r from-accent to-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${p.participant.votePercentage || 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Battle Stats & Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span data-testid="vote-count">{totalVotes} votes</span>
            {battle.status === "active" && (
              <span data-testid="time-left">{getTimeLeft()}</span>
            )}
            {battle.status === "expired" && battle.winnerId && (
              <span className="text-accent font-medium">
                Winner: @{participants.find(p => p.user?.id === battle.winnerId)?.user?.username}
              </span>
            )}
          </div>
          {votedParticipant && battle.status === "active" && (
            <div className="text-sm text-accent font-medium">You voted!</div>
          )}
        </div>

        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center space-x-4">
            <button
              className="flex items-center space-x-1 text-sm"
              disabled={!votedParticipant || battle.status !== "active"}
              data-testid="vote-button"
              aria-label={getAriaLabelForVoteButton(!!votedParticipant, battle.status === "active")}
            >
              <i 
                className={votedParticipant ? "fas fa-vote-yea text-accent" : "far fa-vote-yea"} 
                aria-hidden="true"
              />
              <span>{votedParticipant ? "Voted" : "Vote"}</span>
            </button>
            <button 
              className="flex items-center space-x-1 text-sm" 
              data-testid="feedback-button"
              aria-label={getAriaLabelForButton("feedback")}
            >
              <i className="far fa-comment" aria-hidden="true" />
              <span>Feedback</span>
            </button>
          </div>
          <button 
            data-testid="share-button"
            aria-label={getAriaLabelForButton("share")}
          >
            <i className="far fa-share-alt" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});

export default BattleCard;
