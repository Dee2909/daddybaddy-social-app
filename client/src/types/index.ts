// Re-export types from shared
export * from '@shared/types';

// Frontend-specific User type (camelCase for frontend)
export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImageUrl?: string;
  bio?: string;
  externalLink?: string;
  isPrivate: boolean;
  verified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// Additional frontend-specific types
export interface Conversation {
  otherUser: User;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    read: boolean;
  };
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
}