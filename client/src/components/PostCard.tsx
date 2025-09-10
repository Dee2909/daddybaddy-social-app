import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface PostCardProps {
  post: any;
  author: any;
  isLiked?: boolean;
}

export default function PostCard({ post, author, isLiked: initialIsLiked }: PostCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await apiRequest("DELETE", `/api/posts/${post.id}/like`);
      } else {
        await apiRequest("POST", `/api/posts/${post.id}/like`);
      }
    },
    onSuccess: () => {
      setIsLiked(!isLiked);
      setLikeCount((prev: number) => isLiked ? prev - 1 : prev + 1);
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
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
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" data-testid={`post-card-${post.id}`}>
      <div className="p-4 flex items-center space-x-3">
        <img
          src={author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.username}`}
          alt="User avatar"
          className="w-10 h-10 rounded-full"
          data-testid="post-author-avatar"
        />
        <div className="flex-1">
          <p className="font-semibold" data-testid="post-author-username">@{author?.username}</p>
          <p className="text-sm text-muted-foreground" data-testid="post-time">{formatTime(post.createdAt)}</p>
        </div>
        <button className="p-2 text-muted-foreground" data-testid="post-menu">
          <i className="fas fa-ellipsis-h" />
        </button>
      </div>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt="Post image"
          className="w-full h-80 object-cover"
          data-testid="post-image"
        />
      )}

      <div className="p-4 space-y-3">
        {post.content && (
          <p className="text-sm" data-testid="post-content">{post.content}</p>
        )}
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center space-x-4">
            <button
              className="flex items-center space-x-1"
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              data-testid="like-button"
            >
              <i className={isLiked ? "fas fa-heart text-red-500" : "far fa-heart"} />
              <span data-testid="like-count">{likeCount}</span>
            </button>
            <button className="flex items-center space-x-1" data-testid="comment-button">
              <i className="far fa-comment" />
              <span data-testid="comment-count">{post.commentCount || 0}</span>
            </button>
          </div>
          <button data-testid="share-button">
            <i className="far fa-share-alt" />
          </button>
        </div>
      </div>
    </div>
  );
}
