import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";
import type { User } from "@/types";

interface SelectedUser {
  id: string;
  username: string;
  profileImageUrl?: string;
}

export default function Create() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "close_friends">("public");
  const [title, setTitle] = useState("");

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

  const { data: searchResults } = useQuery<User[]>({
    queryKey: ['/api/users/search', searchQuery],
    enabled: isAuthenticated && searchQuery.length > 0,
    retry: false,
  });

  const createBattleMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await apiRequest("/api/battles", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Battle Created!",
        description: "Your challenge has been sent. Waiting for participants to accept.",
      });
      // Reset form
      setSelectedUsers([]);
      setPhoto(null);
      setPhotoPreview(null);
      setTitle("");
      setVisibility("public");
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
        description: "Failed to create battle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserSelect = (user: User) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, {
        id: user.id,
        username: user.username || '',
        profileImageUrl: user.profileImageUrl || '',
      }]);
    }
    setSearchQuery("");
  };

  const handleUserRemove = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSubmit = () => {
    if (!photo) {
      toast({
        title: "Photo Required",
        description: "Please upload a photo for your battle.",
        variant: "destructive",
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Participants Required",
        description: "Please select at least one user to challenge.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("photo", photo);
    formData.append("title", title);
    formData.append("visibility", visibility);
    formData.append("participants", JSON.stringify(selectedUsers.map(u => u.id)));

    createBattleMutation.mutate(formData);
  };

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="pt-16 pb-20 px-4 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-32 mb-4" />
              <div className="h-40 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-center">Create Battle</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-20 px-4 space-y-6">
        {/* Step 1: Select Challengers */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="select-challengers">
          <h3 className="text-lg font-semibold mb-4">Select Challengers</h3>
          
          {/* Search Users */}
          <div className="relative mb-4">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users to challenge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="user-search-input"
            />
          </div>
          
          {/* Selected Users Pills */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm"
                  data-testid={`selected-user-${user.id}`}
                >
                  <span>@{user.username}</span>
                  <button
                    onClick={() => handleUserRemove(user.id)}
                    className="text-primary/70 hover:text-primary"
                    data-testid={`remove-user-${user.id}`}
                  >
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* User Search Results */}
          {searchQuery && searchResults && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map((user: User) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 p-3 hover:bg-muted rounded-lg cursor-pointer"
                  onClick={() => handleUserSelect(user)}
                  data-testid={`user-result-${user.id}`}
                >
                  <img
                    src={user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                    alt={user.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <p className="font-medium">@{user.username}</p>
                    {user.bio && <p className="text-sm text-muted-foreground truncate">{user.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Upload Photo */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="upload-photo">
          <h3 className="text-lg font-semibold mb-4">Upload Your Photo</h3>
          
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
                data-testid="photo-preview"
              />
              <button
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-8 h-8 flex items-center justify-center"
                data-testid="remove-photo"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <i className="fas fa-camera text-2xl text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium mb-1">Choose your battle photo</p>
                  <p className="text-sm text-muted-foreground">Upload from gallery</p>
                </div>
                <label className="inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="photo-input"
                  />
                  <span className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium cursor-pointer inline-block">
                    <i className="fas fa-images mr-2" />
                    Choose Photo
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Battle Title */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="battle-title">
          <h3 className="text-lg font-semibold mb-4">Battle Title (Optional)</h3>
          <input
            type="text"
            placeholder="Give your battle a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="title-input"
          />
        </div>

        {/* Step 4: Audience Settings */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="visibility-settings">
          <h3 className="text-lg font-semibold mb-4">Battle Visibility</h3>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === "public"}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-primary"
                data-testid="visibility-public"
              />
              <div className="flex-1">
                <p className="font-medium">Public</p>
                <p className="text-sm text-muted-foreground">Anyone can see and vote</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="followers"
                checked={visibility === "followers"}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-primary"
                data-testid="visibility-followers"
              />
              <div className="flex-1">
                <p className="font-medium">Followers</p>
                <p className="text-sm text-muted-foreground">Only your followers can vote</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="close_friends"
                checked={visibility === "close_friends"}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-primary"
                data-testid="visibility-close-friends"
              />
              <div className="flex-1">
                <p className="font-medium">Close Friends</p>
                <p className="text-sm text-muted-foreground">Only close friends can vote</p>
              </div>
            </label>
          </div>
        </div>

        {/* Create Battle Button */}
        <button
          onClick={handleSubmit}
          disabled={createBattleMutation.isPending || !photo || selectedUsers.length === 0}
          className="w-full bg-gradient-to-r from-primary to-accent text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="create-battle-button"
        >
          {createBattleMutation.isPending ? "Creating..." : "Create Challenge"}
        </button>
      </main>
    </div>
  );
}
