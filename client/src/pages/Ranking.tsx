import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import UserCard from "@/components/UserCard";
import { useEffect } from "react";

export default function Ranking() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ranking" | "leaderboard">("ranking");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

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

  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ['/api/ranking'],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: searchData } = useQuery({
    queryKey: ['/api/users/search', searchQuery],
    enabled: isAuthenticated && searchQuery.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (searchData && Array.isArray(searchData)) {
      setSearchResults(searchData);
    }
  }, [searchData]);

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4 space-y-4">
          <div className="h-12 bg-muted rounded-lg animate-pulse" />
          <div className="h-10 bg-muted rounded-lg animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error)) {
    return null; // Redirect will happen in useEffect
  }

  const displayData = searchQuery ? searchResults : rankings || [];

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-center">Ranking</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 px-4 space-y-4">
        {/* Search Bar */}
        <div className="sticky top-16 bg-background/80 backdrop-blur-lg py-3 -mx-4 px-4 border-b border-border">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users & #hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                data-testid="clear-search"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {!searchQuery && (
          <div className="flex space-x-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 py-2 text-sm font-medium rounded-md ${
                activeTab === "ranking"
                  ? "bg-background text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="ranking-tab"
            >
              Ranking
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex-1 py-2 text-sm font-medium rounded-md ${
                activeTab === "leaderboard"
                  ? "bg-background text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="leaderboard-tab"
            >
              Leaderboard
            </button>
          </div>
        )}

        {/* Content */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))
          ) : Array.isArray(displayData) && displayData.length > 0 ? (
            Array.isArray(displayData) ? displayData.map((item: any, index: number) => {
              const user = item.user || item;
              return (
                <UserCard
                  key={user.id}
                  user={user}
                  rank={searchQuery ? undefined : index + 1}
                  showStats={!searchQuery}
                />
              );
            }) : null
          ) : searchQuery ? (
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-search text-3xl mb-3 block" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-sm">Try searching with different keywords</p>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <i className="fas fa-trophy text-3xl mb-3 block" />
              <h3 className="text-lg font-semibold mb-2">No rankings yet</h3>
              <p className="text-sm">Start battling to see the leaderboards!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
