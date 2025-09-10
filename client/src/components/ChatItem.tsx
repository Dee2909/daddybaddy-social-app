interface ChatItemProps {
    conversation: any;
    onClick: () => void;
  }
  
  export default function ChatItem({ conversation, onClick }: ChatItemProps) {
    const formatTime = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days > 0) return `${days}d`;
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return "now";
    };
  
    const hasUnreadMessages = conversation.lastMessage && 
      !conversation.lastMessage.read && 
      conversation.lastMessage.senderId !== conversation.otherUser.id;
  
    return (
      <div
        className="flex items-center space-x-3 p-4 hover:bg-muted rounded-lg cursor-pointer"
        onClick={onClick}
        data-testid={`chat-item-${conversation.otherUser.id}`}
      >
        <div className="relative">
          <img
            src={conversation.otherUser.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conversation.otherUser.username}`}
            alt={conversation.otherUser.username}
            className="w-12 h-12 rounded-full"
            data-testid="chat-avatar"
          />
          {hasUnreadMessages && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full" data-testid="unread-indicator" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-semibold" data-testid="chat-username">@{conversation.otherUser.username}</p>
            <p className="text-xs text-muted-foreground" data-testid="chat-time">
              {formatTime(conversation.lastMessage.createdAt)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground truncate" data-testid="chat-preview">
            {conversation.lastMessage.content}
          </p>
        </div>
      </div>
    );
  }
  