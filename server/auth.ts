import { Request, Response, NextFunction } from "express";
import { storage } from "./supabaseStorage";
import { verifyToken } from "./authUtils";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        profileImageUrl: string;
      };
    }
  }
}

// JWT authentication middleware
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Get user from database
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ message: "Please verify your email before accessing this resource" });
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      username: user.username || '',
      profileImageUrl: user.profile_image_url || '',
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Simple session middleware for development
export const setupSession = (req: Request, res: Response, next: NextFunction) => {
  // In development, no session management needed
  next();
};

// Mock user data for development
export const getDevUser = () => ({
  id: "dev-user-123",
  email: "dev@example.com",
  firstName: "Dev",
  lastName: "User",
  profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=dev",
  username: "devuser",
  bio: "Development user for testing",
  createdAt: new Date(),
  updatedAt: new Date(),
});
