import { useCallback } from 'react';
import { useToast } from './use-toast';
import { isUnauthorizedError, isNetworkError, getErrorMessage } from '@/lib/authUtils';

export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback((error: any, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);

    if (isUnauthorizedError(error)) {
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
      return;
    }

    if (isNetworkError(error)) {
      toast({
        title: "Connection Error",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    // Handle specific HTTP status codes
    const status = error?.status || error?.response?.status;
    if (status) {
      switch (status) {
        case 400:
          toast({
            title: "Invalid Request",
            description: getErrorMessage(error),
            variant: "destructive",
          });
          break;
        case 403:
          toast({
            title: "Access Denied",
            description: "You don't have permission to perform this action.",
            variant: "destructive",
          });
          break;
        case 404:
          toast({
            title: "Not Found",
            description: "The requested resource was not found.",
            variant: "destructive",
          });
          break;
        case 429:
          toast({
            title: "Too Many Requests",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
          });
          break;
        case 500:
          toast({
            title: "Server Error",
            description: "Something went wrong on our end. Please try again later.",
            variant: "destructive",
          });
          break;
        default:
          toast({
            title: "Error",
            description: getErrorMessage(error),
            variant: "destructive",
          });
      }
      return;
    }

    // Generic error fallback
    toast({
      title: "Error",
      description: getErrorMessage(error),
      variant: "destructive",
    });
  }, [toast]);

  return { handleError };
}

