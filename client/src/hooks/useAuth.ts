import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@/types";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/profile"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No token found");
      }

      const response = await apiRequest("/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // If token is invalid, remove it
        localStorage.removeItem("authToken");
        throw new Error("Invalid token");
      }

      const data = await response.json();
      return data.user;
    },
    retry: false,
    enabled: !!localStorage.getItem("authToken"),
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
