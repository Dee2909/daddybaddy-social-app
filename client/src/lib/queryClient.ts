import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isUnauthorizedError, isNetworkError, getErrorMessage } from "./authUtils";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error || res.statusText;
    } catch {
      // If JSON parsing fails, try to get text
      try {
        const text = await res.text();
        errorMessage = text || res.statusText;
      } catch {
        // Use status text as fallback
        errorMessage = res.statusText;
      }
    }
    
    const error = new Error(`${res.status}: ${errorMessage}`);
    (error as any).status = res.status;
    (error as any).statusText = res.statusText;
    throw error;
  }
}

export async function apiRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem("authToken");
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey.join("/") as string;
    
    // Handle search queries with query parameters
    if (url.includes('/api/users/search') && queryKey.length > 1) {
      const searchQuery = queryKey[1] as string;
      url = `/api/users/search?q=${encodeURIComponent(searchQuery)}`;
    }
    
    const token = localStorage.getItem("authToken");
    
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401 (unauthorized) or 403 (forbidden)
        if (isUnauthorizedError(error) || (error as any)?.status === 403) {
          return false;
        }
        // Retry network errors up to 3 times
        if (isNetworkError(error)) {
          return failureCount < 3;
        }
        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx)
        if ((error as any)?.status >= 400 && (error as any)?.status < 500) {
          return false;
        }
        // Retry network errors up to 2 times
        if (isNetworkError(error)) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
