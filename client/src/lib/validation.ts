// Input validation utilities

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): boolean {
  // Username should be 3-20 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

export function validatePassword(password: string): boolean {
  // Password should be at least 8 characters
  return password.length >= 8;
}

export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'File must be a JPG, PNG, GIF, or WebP image' };
  }
  
  return { valid: true };
}

export function validateBattleTitle(title: string): boolean {
  // Title should be 1-100 characters
  return title.length >= 1 && title.length <= 100;
}

export function validatePostContent(content: string): boolean {
  // Content should be 1-2000 characters
  return content.length >= 1 && content.length <= 2000;
}

export function validateCommentContent(content: string): boolean {
  // Comment should be 1-500 characters
  return content.length >= 1 && content.length <= 500;
}

export function validateMessageContent(content: string): boolean {
  // Message should be 1-1000 characters
  return content.length >= 1 && content.length <= 1000;
}

export function validateBio(bio: string): boolean {
  // Bio should be 0-500 characters
  return bio.length <= 500;
}

export function validateExternalLink(link: string): boolean {
  // Should be a valid URL
  try {
    new URL(link);
    return true;
  } catch {
    return false;
  }
}
