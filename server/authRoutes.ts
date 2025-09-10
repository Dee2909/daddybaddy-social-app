import express from 'express';
import { storage } from './supabaseStorage';
import { User, InsertOtp } from '../shared/types';
import { isAuthenticated } from './auth';
// Removed unused imports
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  verifyToken,
  generateOTPWithExpiry,
  isValidEmail,
  validatePassword,
  validateUsername,
  sanitizeInput
} from './authUtils';
// Note: Schema validation will be handled by Supabase RLS and manual validation
import { z } from 'zod';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working' });
});

// Database test endpoint
router.get('/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    
    // Test a simple query first
    const result = await storage.searchUsers('test', undefined, 1);
    console.log('Database test successful, found', result.length, 'users');
    res.json({ message: 'Database connection working', userCount: result.length });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      message: 'Database connection failed', 
      error: error instanceof Error ? error.message : JSON.stringify(error)
    });
  }
});

// Registration schema
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
});

// Login schema - supports email, username, or phone
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email, username, or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

// Send OTP schema
const sendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  type: z.enum(['email_verification', 'password_reset']),
});

// Password reset request schema
const passwordResetRequestSchema = z.object({
  identifier: z.string().min(1, 'Email, username, or phone is required'),
});

// Password reset schema
const passwordResetSchema = z.object({
  identifier: z.string().min(1, 'Email, username, or phone is required'),
  code: z.string().min(6, 'OTP code is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const validatedData = registerSchema.parse(req.body);
    const { email, password, firstName, lastName, username, phone } = validatedData;
    console.log('Validation passed for:', email);

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        message: 'Password validation failed', 
        errors: passwordValidation.errors 
      });
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return res.status(400).json({ 
        message: 'Username validation failed', 
        errors: usernameValidation.errors 
      });
    }

    // Check if user already exists
    console.log('Checking if user exists for email:', email);
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Check if username is taken
    console.log('Checking if username exists:', username);
    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    // Check if phone number is already taken (if provided)
    if (phone) {
      console.log('Checking if phone exists:', phone);
      const existingPhone = await storage.getUserByPhone(phone, '+1'); // Default country code
      if (existingPhone) {
        return res.status(409).json({ message: 'Phone number is already registered' });
      }
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await hashPassword(password);

    // Create user
    const userData = {
      email: sanitizeInput(email),
      password: hashedPassword,
      first_name: sanitizeInput(firstName),
      last_name: sanitizeInput(lastName),
      username: sanitizeInput(username),
      phone: phone ? sanitizeInput(phone) : undefined,
      country_code: phone ? '+1' : undefined, // Default country code
      profile_image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      email_verified: true, // Skip verification for now
      phone_verified: false,
    };

    console.log('Creating user in database...');
    const user = await storage.createUser(userData);

    // Generate JWT token for immediate login
    const token = generateToken(user.id, user.email);

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        profileImageUrl: user.profile_image_url || ''
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: error.errors 
      });
    }
    
    console.error('Registration error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : JSON.stringify(error)) : undefined
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { identifier, password } = validatedData;

    // Determine if identifier is email, username, or phone and find user
    let user: User | undefined;
    
    if (identifier.includes('@')) {
      // Email login
      user = await storage.getUserByEmail(identifier);
    } else if (/^\d+$/.test(identifier.replace(/\D/g, ''))) {
      // Phone login - try different country codes
      const phoneNumber = identifier.replace(/\D/g, '');
      const commonCountryCodes = ['+1', '+44', '+91', '+86', '+81', '+49', '+33', '+39', '+34', '+61', '+55', '+7'];
      
      for (const countryCode of commonCountryCodes) {
        user = await storage.getUserByPhone(phoneNumber, countryCode);
        if (user) break;
      }
    } else {
      // Username login
      user = await storage.getUserByUsername(identifier);
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ 
        message: 'Please verify your email before logging in',
        email: user.email
      });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: error.errors 
      });
    }
    
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  try {
    const validatedData = sendOtpSchema.parse(req.body);
    const { email, type } = validatedData;

    // Check if user exists (for password reset)
    if (type === 'password_reset') {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // Generate OTP
    const { code, expiresAt } = generateOTPWithExpiry();
    
    // Store OTP in database
    await storage.createOTP({
      email,
      code,
      type,
      expires_at: expiresAt.toISOString(),
    });

    // TODO: Send OTP via email (implement email service)
    console.log(`OTP for ${email} (${type}): ${code}`);

    res.json({ 
      message: 'OTP sent successfully',
      email 
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: error.errors 
      });
    }
    
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code, type } = req.body;
    
    // Basic validation
    if (!email || !code || !type) {
      return res.status(400).json({ message: 'Email, code, and type are required' });
    }

    // Verify OTP
    const otp = await storage.verifyOTP({ email, code, type });
    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    await storage.markOTPAsUsed(otp.id);

    // Handle different OTP types
    if (type === 'email_verification') {
      // Update user email verification status
      const user = await storage.getUserByEmail(email);
      if (user) {
        await storage.updateUser(user.id, { email_verified: true });
      }
      
      res.json({ 
        message: 'Email verified successfully',
        email 
      });
    } else if (type === 'password_reset') {
      // Generate password reset token
      const resetToken = generateToken(email, 'password_reset');
      
      res.json({ 
        message: 'OTP verified successfully',
        resetToken,
        email 
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: error.errors 
      });
    }
    
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    // Verify reset token
    const decoded = verifyToken(resetToken);
    if (!decoded || decoded.email === 'password_reset') {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        message: 'Password validation failed', 
        errors: passwordValidation.errors 
      });
    }

    // Find user and update password
    const user = await storage.getUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashedPassword });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Password reset request endpoint
router.post('/password-reset-request', async (req, res) => {
  try {
    const validatedData = passwordResetRequestSchema.parse(req.body);
    const { identifier } = validatedData;

    // Find user by identifier (email, username, or phone)
    let user: User | undefined;
    
    if (identifier.includes('@')) {
      user = await storage.getUserByEmail(identifier);
    } else if (/^\d+$/.test(identifier.replace(/\D/g, ''))) {
      const phoneNumber = identifier.replace(/\D/g, '');
      const commonCountryCodes = ['+1', '+44', '+91', '+86', '+81', '+49', '+33', '+39', '+34', '+61', '+55', '+7'];
      
      for (const countryCode of commonCountryCodes) {
        user = await storage.getUserByPhone(phoneNumber, countryCode);
        if (user) break;
      }
    } else {
      user = await storage.getUserByUsername(identifier);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate OTP for password reset
    const { code, expiresAt } = generateOTPWithExpiry();
    await storage.createOTP({
      email: user.email,
      code,
      type: 'password_reset',
      expires_at: expiresAt.toISOString(),
    });

    // Send OTP via email (placeholder - implement actual email sending)
    console.log(`Password reset OTP for ${user.email}: ${code}`);

    res.json({ 
      message: 'Password reset OTP sent to your email',
      email: user.email 
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Password reset endpoint
router.post('/password-reset', async (req, res) => {
  try {
    const validatedData = passwordResetSchema.parse(req.body);
    const { identifier, code, newPassword } = validatedData;

    // Find user by identifier
    let user: User | undefined;
    
    if (identifier.includes('@')) {
      user = await storage.getUserByEmail(identifier);
    } else if (/^\d+$/.test(identifier.replace(/\D/g, ''))) {
      const phoneNumber = identifier.replace(/\D/g, '');
      const commonCountryCodes = ['+1', '+44', '+91', '+86', '+81', '+49', '+33', '+39', '+34', '+61', '+55', '+7'];
      
      for (const countryCode of commonCountryCodes) {
        user = await storage.getUserByPhone(phoneNumber, countryCode);
        if (user) break;
      }
    } else {
      user = await storage.getUserByUsername(identifier);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify OTP
    const otp = await storage.getOTP(user.email, code, 'password_reset');
    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        message: 'Password validation failed', 
        errors: passwordValidation.errors 
      });
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashedPassword });

    // Mark OTP as used
    await storage.markOTPAsUsed(otp.id);

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', isAuthenticated, async (req: any, res: any) => {
  try {
    const user = req.user; // User is already attached by isAuthenticated middleware
    res.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        profileImageUrl: user.profile_image_url || '',
        bio: user.bio,
        externalLink: user.external_link,
        isPrivate: user.is_private,
        verified: user.verified,
        emailVerified: user.email_verified,
        phoneVerified: user.phone_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
