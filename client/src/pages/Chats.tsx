import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import ChatItem from "@/components/ChatItem";

export default function Chats() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");

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

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['/api/conversations'],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: messages } = useQuery({
    queryKey: ['/api/conversations', selectedConversation?.otherUser?.id],
    enabled: isAuthenticated && !!selectedConversation?.otherUser?.id,
    retry: false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          content,
        }),
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', selectedConversation?.otherUser?.id] 
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
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-24 mb-1" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error)) {
    return null; // Redirect will happen in useEffect
  }

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Messages</h1>
          <button
            onClick={() => setSelectedConversation(null)}
            className="p-2"
            data-testid="back-button"
          >
            <i className="fas fa-arrow-left text-xl" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20">
        {!selectedConversation ? (
          // Conversations List
          <div className="px-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="search-input"
              />
            </div>

            {/* Conversations */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-muted rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-24 mb-1" />
                        <div className="h-3 bg-muted rounded w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations && Array.isArray(conversations) && conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations
                  .filter((conv: any) => 
                    conv.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((conversation: any) => (
                    <ChatItem
                      key={conversation.otherUser?.id}
                      conversation={conversation}
                      onClick={() => setSelectedConversation(conversation)}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-16">
                <i className="fas fa-comment text-4xl mb-4 block" />
                <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                <p className="text-sm">Start a conversation with someone!</p>
              </div>
            )}
          </div>
        ) : (
          // Chat Messages
          <div className="flex flex-col h-screen">
            {/* Chat Header */}
            <div className="flex items-center space-x-3 p-4 border-b border-border">
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-2"
                data-testid="back-to-conversations"
              >
                <i className="fas fa-arrow-left" />
              </button>
              <img
                src={selectedConversation.otherUser?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedConversation.otherUser?.username}`}
                alt={selectedConversation.otherUser?.username}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h3 className="font-semibold">@{selectedConversation.otherUser?.username}</h3>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages && Array.isArray(messages) && messages.length > 0 ? (
                messages.map((message: any) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === selectedConversation.otherUser?.id ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.senderId === selectedConversation.otherUser?.id
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-input border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="message-input"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="send-button"
                >
                  {sendMessageMutation.isPending ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : (
                    <i className="fas fa-paper-plane" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
