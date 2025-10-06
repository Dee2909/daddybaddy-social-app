import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';
import apiService from './services/api';
import realtimeService from './services/realtime';
import "./App.css";

// Initialize Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API Configuration
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data (custom authentication)
    const storedUser = localStorage.getItem('user');
    const accessToken = localStorage.getItem('access_token');
    
    if (storedUser && accessToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    
    setLoading(false);
  }, []);

  const signInWithCredentials = async (username, password) => {
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'Login failed' } };
      }
      
      // Store tokens and user data locally (custom authentication)
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Update user state
      setUser(data.user);
      
      return { data: data.user, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const sendOTP = async (phone) => {
    try {
      // Format phone number for Twilio (E.164 format)
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        // For Indian numbers, use +91 prefix
        formattedPhone = '+91' + formattedPhone.replace(/\D/g, '');
      }
      
      // Use our backend Twilio OTP endpoint
      const response = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'Failed to send OTP' } };
      }
      
      return { data, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const verifyOTP = async (phone, token) => {
    try {
      // Use our backend Twilio OTP verification endpoint
      const response = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phone.trim(), 
          token: token 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'OTP verification failed' } };
      }
      
      return { data, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const registerUser = async (userData) => {
    try {
      // Temporarily register without OTP verification
      const response = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'Registration failed' } };
      }
      
      return { data, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const resetPassword = async (phone) => {
    try {
      const response = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'Failed to send reset code' } };
      }
      
      return { data, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const confirmPasswordReset = async (phone, token, newPassword) => {
    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token, new_password: newPassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { error: { message: data.detail || 'Password reset failed' } };
      }
      
      return { data, error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const signOut = async () => {
    // Clear custom authentication data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithCredentials,
      sendOTP,
      verifyOTP,
      registerUser,
      resetPassword,
      confirmPasswordReset,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Login Component
const Login = () => {
  const { signInWithCredentials, resetPassword, confirmPasswordReset, loading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState('phone'); // 'phone', 'otp', 'newPassword'
  const [resetData, setResetData] = useState({ phone: '', otp: '', newPassword: '', confirmPassword: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const { data, error } = await signInWithCredentials(formData.username, formData.password);
    
    if (error) {
      setError(error.message);
    } else if (data) {
      // Redirect to home page after successful login
      navigate('/');
    }
    
    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (forgotPasswordStep === 'phone') {
      const { error } = await resetPassword(resetData.phone);
      if (error) {
        setError(error.message);
      } else {
        setForgotPasswordStep('otp');
      }
    } else if (forgotPasswordStep === 'otp') {
      if (resetData.newPassword !== resetData.confirmPassword) {
        setError('Passwords do not match');
        setIsSubmitting(false);
        return;
      }
      
      const { error } = await confirmPasswordReset(resetData.phone, resetData.otp, resetData.newPassword);
      if (error) {
        setError(error.message);
      } else {
        setShowForgotPassword(false);
        setForgotPasswordStep('phone');
        setResetData({ phone: '', otp: '', newPassword: '', confirmPassword: '' });
        alert('Password reset successfully! Please login with your new password.');
      }
    }
    
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-md w-full space-y-4 sm:space-y-6 p-4 sm:p-8">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-2 sm:mb-4">DaddyBaddy</h1>
          <p className="text-purple-200 text-sm sm:text-base">Join the ultimate battle platform</p>
        </div>
        
        {!showForgotPassword ? (
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-purple-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Enter your password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:transform-none font-medium text-sm sm:text-base touch-manipulation"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-purple-300 hover:text-white active:text-purple-100 text-xs sm:text-sm transition-colors duration-200 touch-manipulation"
              >
                Forgot Password?
              </button>
              <div className="text-purple-200 text-xs sm:text-sm">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => window.location.href = '/register'}
                  className="text-purple-300 hover:text-white active:text-purple-100 font-medium transition-colors duration-200 touch-manipulation"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-white">Reset Password</h3>
              <p className="text-purple-200 text-sm">
                {forgotPasswordStep === 'phone' ? 'Enter your phone number' : 'Enter OTP and new password'}
              </p>
            </div>

            {forgotPasswordStep === 'phone' ? (
              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={resetData.phone}
                  onChange={(e) => setResetData({...resetData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="+919876543210"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-purple-200 text-sm font-medium mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={resetData.otp}
                    onChange={(e) => setResetData({...resetData, otp: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest"
                    placeholder="123456"
                    maxLength="6"
                    required
                  />
                </div>

                <div>
                  <label className="block text-purple-200 text-sm font-medium mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={resetData.newPassword}
                    onChange={(e) => setResetData({...resetData, newPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter new password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-purple-200 text-sm font-medium mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={resetData.confirmPassword}
                    onChange={(e) => setResetData({...resetData, confirmPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </>
            )}
            
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
              >
                {isSubmitting ? 'Processing...' : forgotPasswordStep === 'phone' ? 'Send OTP' : 'Reset Password'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordStep('phone');
                  setResetData({ phone: '', otp: '', newPassword: '', confirmPassword: '' });
                  setError('');
                }}
                className="w-full px-4 py-2 text-purple-200 hover:text-white transition-colors duration-200"
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Register Component
const Register = () => {
  const { registerUser, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('details'); // 'details', 'profile'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [profileData, setProfileData] = useState({
    bio: '',
    location: '',
    website: '',
    avatar: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validateAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    
    return age;
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate age
    if (validateAge(formData.dateOfBirth) < 18) {
      setError('You must be at least 18 years old to register');
      return;
    }

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Format phone number for Indian numbers
    let formattedPhone = formData.phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone.replace(/\D/g, '');
    }

    setIsSubmitting(true);
    // Skip OTP for now; proceed directly to profile step
    setFormData({...formData, phone: formattedPhone});
    setStep('profile');
    setIsSubmitting(false);
  };

  const handleProfileSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const userData = {
      ...formData,
      ...profileData,
      fullName: `${formData.firstName} ${formData.lastName}`,
      // Ensure username is included
      username: formData.username || `${formData.firstName}${formData.lastName}`.toLowerCase()
    };

    const { error } = await registerUser(userData);
    
    if (error) {
      setError(error.message);
    } else {
      alert('Registration successful! You can now login with your phone number and password.');
      navigate('/login');
    }
    
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900 py-4 sm:py-8 px-4">
      <div className="max-w-md w-full space-y-4 sm:space-y-6 p-4 sm:p-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-1 sm:mb-2">DaddyBaddy</h1>
          <p className="text-purple-200 text-sm sm:text-base">Create your account</p>
          
          {/* Progress indicator (details -> profile) */}
          <div className="flex justify-center mt-3 sm:mt-4 space-x-2">
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${step === 'details' ? 'bg-purple-400' : 'bg-purple-600'}`}></div>
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${step === 'profile' ? 'bg-purple-400' : 'bg-purple-800'}`}></div>
          </div>
        </div>
        
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label className="block text-purple-200 text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="+919876543210"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Date of Birth * (Must be 18+)
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Username * (Unique)
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Choose a unique username"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Password *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Create a strong password"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Confirm your password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
            >
              {isSubmitting ? 'Sending OTP...' : 'Next: Verify Phone'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => window.location.href = '/login'}
                className="text-purple-300 hover:text-white text-sm transition-colors duration-200"
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        )}

        

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-white">Complete Your Profile</h3>
              <p className="text-purple-200 text-sm">Add some details about yourself (optional)</p>
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Bio
              </label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Tell us about yourself..."
                rows="3"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Location
              </label>
              <input
                type="text"
                value={profileData.location}
                onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your city, country"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2">
                Website
              </label>
              <input
                type="url"
                value={profileData.website}
                onChange={(e) => setProfileData({...profileData, website: e.target.value})}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://yourwebsite.com"
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none font-medium"
              >
                {isSubmitting ? 'Creating Account...' : 'Complete Registration'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  // Skip profile setup
                  handleProfileSubmit();
                }}
                className="w-full px-4 py-2 text-purple-200 hover:text-white transition-colors duration-200"
              >
                Skip for now
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Battle Card Component (unchanged from previous version)
const BattleCard = ({ battle, onVote, results, userVote }) => {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (choice) => {
    if (isVoting || userVote) return;
    
    setIsVoting(true);
    try {
      await onVote(battle.id, choice);
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (choice) => {
    if (!results || results.total_votes === 0) return 0;
    return choice === 'A' ? results.option_a_percentage : results.option_b_percentage;
  };

  const getVoteCount = (choice) => {
    if (!results) return 0;
    return choice === 'A' ? results.option_a_votes : results.option_b_votes;
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
      <h3 className="text-xl font-bold text-white mb-2">{battle.title}</h3>
      {battle.description && (
        <p className="text-purple-200 mb-4">{battle.description}</p>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Option A */}
        <div className="space-y-2">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 h-32 flex items-center justify-center">
            <span className="text-white font-semibold text-center">{battle.option_a}</span>
          </div>
          
          {results && (
            <div className="text-center">
              <div className="text-white font-bold">{getPercentage('A')}%</div>
              <div className="text-purple-200 text-sm">{getVoteCount('A')} votes</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getPercentage('A')}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => handleVote('A')}
            disabled={isVoting || userVote}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              userVote === 'A' 
                ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                : userVote
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white hover:scale-105'
            }`}
          >
            {userVote === 'A' ? '✓ Your Vote' : isVoting ? 'Voting...' : 'Vote A'}
          </button>
        </div>

        {/* Option B */}
        <div className="space-y-2">
          <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg p-4 h-32 flex items-center justify-center">
            <span className="text-white font-semibold text-center">{battle.option_b}</span>
          </div>
          
          {results && (
            <div className="text-center">
              <div className="text-white font-bold">{getPercentage('B')}%</div>
              <div className="text-purple-200 text-sm">{getVoteCount('B')} votes</div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className="bg-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getPercentage('B')}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => handleVote('B')}
            disabled={isVoting || userVote}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              userVote === 'B' 
                ? 'bg-pink-600 text-white ring-2 ring-pink-400' 
                : userVote
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-pink-500 hover:bg-pink-600 text-white hover:scale-105'
            }`}
          >
            {userVote === 'B' ? '✓ Your Vote' : isVoting ? 'Voting...' : 'Vote B'}
          </button>
        </div>
      </div>
      
      {results && (
        <div className="text-center text-purple-200 text-sm">
          Total votes: {results.total_votes}
        </div>
      )}
    </div>
  );
};


// ==================== UI COMPONENTS ====================

// Avatar Component - Mobile Responsive
const Avatar = ({ src, size = 'md', onClick, className = '' }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm', 
    md: 'w-10 h-10 sm:w-12 sm:h-12 text-sm sm:text-base',
    lg: 'w-12 h-12 sm:w-14 sm:h-14 text-base sm:text-lg',
    xl: 'w-16 h-16 sm:w-18 sm:h-18 text-lg sm:text-xl',
    '2xl': 'w-20 h-20 sm:w-24 sm:h-24 text-xl sm:text-2xl'
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:scale-105 active:scale-95 transition-transform touch-manipulation ${className}`}
      onClick={onClick}
    >
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="text-sm sm:text-base">?</span>
      )}
    </div>
  );
};

// UserRow Component - Mobile Responsive
const UserRow = ({ user, rank, onFollowToggle, isFollowing = false }) => {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation">
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
        {rank && (
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
            {rank}
          </div>
        )}
        <Avatar src={user.avatar} size="sm" className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-sm sm:text-base truncate">@{user.username}</div>
          <div className="text-purple-200 text-xs sm:text-sm truncate">
            {user.wins || 0}W • {user.losses || 0}L • {((user.wins || 0) / ((user.wins || 0) + (user.losses || 0)) * 100 || 0).toFixed(1)}% W/L
          </div>
        </div>
      </div>
      <button
        onClick={() => onFollowToggle(user.id)}
        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors touch-manipulation flex-shrink-0 ${
          isFollowing 
            ? 'bg-gray-600 text-gray-300 hover:bg-gray-700 active:bg-gray-800' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
};

// PostCard Component - Mobile Responsive
const PostCard = ({ post, onLike, onCommentOpen, onShare, onReport, onReply, onQuote, onRepost }) => {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [showActions, setShowActions] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike(post.id);
  };

  const handleReply = () => {
    onReply(post.id);
  };

  const handleQuote = () => {
    onQuote(post.id);
  };

  const handleRepost = () => {
    onRepost(post.id);
  };

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden mb-3 sm:mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <Avatar src={post.user.avatar} size="sm" className="flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm sm:text-base truncate">@{post.user.username}</div>
            <div className="text-purple-200 text-xs sm:text-sm">{post.timeAgo}</div>
          </div>
        </div>
        <button 
          onClick={() => onReport(post.id)} 
          className="text-purple-300 hover:text-white active:text-purple-100 p-1 touch-manipulation flex-shrink-0"
        >
          ⋯
        </button>
      </div>

      {/* Image */}
      {post.image && (
        <div className="aspect-video bg-gray-800">
          <img src={post.image} alt="Post" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Footer */}
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={handleLike}
              className={`flex items-center space-x-1 sm:space-x-2 touch-manipulation ${isLiked ? 'text-red-500' : 'text-purple-300 hover:text-white active:text-purple-100'}`}
            >
              <span className="text-lg sm:text-xl">{isLiked ? '❤️' : '🤍'}</span>
              <span className="text-sm sm:text-base">{likeCount}</span>
            </button>
            <button 
              onClick={handleReply}
              className="flex items-center space-x-1 sm:space-x-2 text-purple-300 hover:text-white active:text-purple-100 touch-manipulation"
            >
              <span className="text-lg sm:text-xl">💬</span>
              <span className="text-sm sm:text-base">{post.commentCount || 0}</span>
            </button>
            <button 
              onClick={handleQuote}
              className="flex items-center space-x-1 sm:space-x-2 text-purple-300 hover:text-white active:text-purple-100 touch-manipulation"
            >
              <span className="text-lg sm:text-xl">💬</span>
              <span className="text-sm sm:text-base">{post.quoteCount || 0}</span>
            </button>
            <button 
              onClick={handleRepost}
              className="flex items-center space-x-1 sm:space-x-2 text-purple-300 hover:text-white active:text-purple-100 touch-manipulation"
            >
              <span className="text-lg sm:text-xl">🔄</span>
              <span className="text-sm sm:text-base">Repost</span>
            </button>
            <button 
              onClick={() => onShare(post.id)}
              className="text-purple-300 hover:text-white active:text-purple-100 touch-manipulation"
            >
              <span className="text-lg sm:text-xl">📤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// VoteMeter Component - Mobile Responsive
const VoteMeter = ({ totals, myVoteUserId, participantA, participantB }) => {
  const safeTotals = totals || { A: 0, B: 0 };
  const totalVotes = (safeTotals.A || 0) + (safeTotals.B || 0);
  const percentageA = totalVotes > 0 ? (totals.A / totalVotes) * 100 : 0;
  const percentageB = totalVotes > 0 ? (totals.B / totalVotes) * 100 : 0;
  const nameA = participantA?.username || participantA?.full_name || participantA?.name || 'Option A';
  const nameB = participantB?.username || participantB?.full_name || participantB?.name || 'Option B';
  const idA = participantA?.id || 'A';
  const idB = participantB?.id || 'B';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs sm:text-sm text-purple-200">
        <span className="truncate max-w-[40%]">@{nameA}</span>
        <span className="truncate max-w-[40%] text-right">@{nameB}</span>
      </div>
      <div className="flex h-6 sm:h-8 rounded-lg overflow-hidden">
        <div 
          className={`flex items-center justify-center text-white font-semibold text-xs sm:text-sm transition-all duration-500 ${
            myVoteUserId === idA ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentageA}%` }}
        >
          {percentageA.toFixed(1)}%
        </div>
        <div 
          className={`flex items-center justify-center text-white font-semibold text-xs sm:text-sm transition-all duration-500 ${
            myVoteUserId === idB ? 'bg-green-500' : 'bg-pink-500'
          }`}
          style={{ width: `${percentageB}%` }}
        >
          {percentageB.toFixed(1)}%
        </div>
      </div>
      <div className="flex justify-between text-xs text-purple-300">
        <span>{totals.A} votes</span>
        <span>{totals.B} votes</span>
      </div>
    </div>
  );
};

// Countdown Component - Mobile Responsive
const Countdown = ({ endsAt }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const endTime = new Date(endsAt).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft('00:00:00');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="text-center">
      <div className="text-lg sm:text-2xl font-mono font-bold text-white">{timeLeft}</div>
      <div className="text-purple-200 text-xs sm:text-sm">Time Left</div>
    </div>
  );
};

// SearchBar Component - Mobile Responsive
const SearchBar = ({ value, onChange, onClear, placeholder = "Search..." }) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 sm:px-4 sm:py-3 pl-8 sm:pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
      />
      <div className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-purple-300 text-sm sm:text-base">
        🔍
      </div>
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-purple-300 hover:text-white active:text-purple-100 touch-manipulation p-1"
        >
          ✕
        </button>
      )}
    </div>
  );
};

// Empty State Component - Mobile Responsive
const Empty = ({ icon, title, subtitle, cta }) => {
  return (
    <div className="text-center py-8 sm:py-12 px-4">
      <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">{icon}</div>
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-purple-200 mb-4 sm:mb-6 text-sm sm:text-base max-w-sm mx-auto">{subtitle}</p>
      {cta && (
        <button className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800 transition-all duration-200 text-sm sm:text-base touch-manipulation">
          {cta}
        </button>
      )}
    </div>
  );
};

// Enhanced Battle Card Component - Mobile Responsive
const EnhancedBattleCard = ({ battle, onVote, onPrivateComment, onShare, onReport, onClick }) => {
  const [isVoting, setIsVoting] = useState(false);
  const [showPrivateComment, setShowPrivateComment] = useState(false);
  const [privateComment, setPrivateComment] = useState('');

  const handleVote = async (choice) => {
    if (isVoting || battle.userVote) return;
    
    setIsVoting(true);
    try {
      await onVote(battle.id, choice);
    } finally {
      setIsVoting(false);
    }
  };

  const handlePrivateComment = async () => {
    if (!privateComment.trim()) return;
    
    try {
      await onPrivateComment(battle.id, privateComment);
      setPrivateComment('');
      setShowPrivateComment(false);
    } catch (error) {
      console.error('Error sending private comment:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ongoing': return 'bg-green-500';
      case 'expired': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getVisibilityChip = (visibility) => {
    switch (visibility) {
      case 'public': return { text: 'Public', color: 'bg-blue-500' };
      case 'followers': return { text: 'Followers', color: 'bg-purple-500' };
      case 'close_friends': return { text: 'CF', color: 'bg-pink-500' };
      default: return { text: 'Public', color: 'bg-blue-500' };
    }
  };

  const visibility = getVisibilityChip(battle.visibility || 'public');
  const status = battle.status || 'ongoing';

  return (
    <div 
      className="bg-white/5 rounded-lg overflow-hidden mb-3 sm:mb-4 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <div className="flex -space-x-1">
            <Avatar src={battle.creator?.avatar} size="sm" className="border-2 border-white/20" />
            {battle.challengers?.slice(0, 2).map((challenger, index) => (
              <Avatar 
                key={challenger.id} 
                src={challenger.avatar} 
                size="sm" 
                className="border-2 border-white/20" 
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm sm:text-base truncate">
              {battle.creator?.username} vs {battle.challengers?.map(c => c.username).join(', ')}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${visibility.color}`}>
                {visibility.text}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(status)}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onReport(battle.id);
          }}
          className="text-purple-300 hover:text-white active:text-purple-100 p-1 touch-manipulation flex-shrink-0"
        >
          ⋯
        </button>
      </div>

      {/* Media Grid */}
      {battle.media && battle.media.length > 0 && (
        <div className={`grid gap-1 ${battle.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {battle.media.slice(0, 4).map((media, index) => (
            <div key={index} className="aspect-square bg-gray-800">
              <img 
                src={media.url} 
                alt={`Battle media ${index + 1}`} 
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Vote Meter */}
      <div className="p-3 sm:p-4">
        <VoteMeter
          totals={battle.voteTotals || battle.vote_counts || { A: 0, B: 0 }}
          myVoteUserId={battle.userVote}
          participantA={battle.creator || { username: battle.option_a || 'Option A', id: 'A' }}
          participantB={battle.challengers?.[0] || { username: battle.option_b || 'Option B', id: 'B' }}
        />
      </div>

      {/* Countdown */}
      {battle.endsAt && status === 'ongoing' && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <Countdown endsAt={battle.endsAt} />
        </div>
      )}

      {/* Vote Buttons */}
      {status === 'ongoing' && !battle.userVote && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVote('A');
              }}
              disabled={isVoting}
              className="py-2 sm:py-3 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation disabled:opacity-50"
            >
              {isVoting ? 'Voting...' : 'Vote A'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVote('B');
              }}
              disabled={isVoting}
              className="py-2 sm:py-3 px-4 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation disabled:opacity-50"
            >
              {isVoting ? 'Voting...' : 'Vote B'}
            </button>
          </div>
        </div>
      )}

      {/* Voted State */}
      {battle.userVote && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="text-center py-2 sm:py-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <span className="text-green-400 text-sm sm:text-base font-medium">
              ✓ You voted for {battle.userVote === 'A' ? 'A' : 'B'}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <span className="text-purple-200 text-xs sm:text-sm">
              {battle.totalVotes || 0} votes
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPrivateComment(true);
              }}
              className="text-purple-300 hover:text-white active:text-purple-100 text-xs sm:text-sm transition-colors touch-manipulation"
            >
              Private comment to creator
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(battle.id);
            }}
            className="text-purple-300 hover:text-white active:text-purple-100 touch-manipulation"
          >
            <span className="text-lg sm:text-xl">📤</span>
          </button>
        </div>
      </div>

      {/* Private Comment Modal */}
      {showPrivateComment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 w-full max-w-md">
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Send Private Comment</h3>
            <textarea
              value={privateComment}
              onChange={(e) => setPrivateComment(e.target.value)}
              placeholder="Write your comment to the creator..."
              className="w-full h-20 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base resize-none"
            />
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => setShowPrivateComment(false)}
                className="flex-1 py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handlePrivateComment}
                disabled={!privateComment.trim()}
                className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Skeleton Components - Mobile Responsive
const CardSkeleton = () => (
  <div className="bg-white/5 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 animate-pulse">
    <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex-shrink-0"></div>
      <div className="space-y-2 flex-1 min-w-0">
        <div className="h-3 sm:h-4 w-20 sm:w-24 bg-white/20 rounded"></div>
        <div className="h-2 sm:h-3 w-12 sm:w-16 bg-white/20 rounded"></div>
      </div>
    </div>
    <div className="h-32 sm:h-48 bg-white/20 rounded mb-3 sm:mb-4"></div>
    <div className="flex space-x-2 sm:space-x-4">
      <div className="h-3 sm:h-4 w-12 sm:w-16 bg-white/20 rounded"></div>
      <div className="h-3 sm:h-4 w-12 sm:w-16 bg-white/20 rounded"></div>
      <div className="h-3 sm:h-4 w-12 sm:w-16 bg-white/20 rounded"></div>
    </div>
  </div>
);

// Home Component - Complete Feed Implementation
const Home = ({ unreadCount }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [feedItems, setFeedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [sentinelRef, setSentinelRef] = useState(null);

  useEffect(() => {
    fetchFeed();
    
    // Set up real-time subscriptions
    const battlesSubscription = realtimeService.subscribeToBattles((payload) => {
      console.log('Battle update:', payload);
      // Update feed when battles change
      fetchFeed(0);
    });
    
    const postsSubscription = realtimeService.subscribeToPosts((payload) => {
      console.log('Post update:', payload);
      // Update feed when posts change
      fetchFeed(0);
    });
    
    return () => {
      realtimeService.unsubscribe('battles_null');
      realtimeService.unsubscribe('posts_null');
    };
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef);
    return () => observer.disconnect();
  }, [sentinelRef, hasMore, isLoadingMore]);

  const fetchFeed = async (pageNum = 0) => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      // Use enhanced feed if user is authenticated, otherwise fallback to regular posts
      let postsResponse, battlesResponse;
      
      if (user?.id) {
        try {
          const feedResponse = await apiService.getUserFeed(user.id, pageNum * 10, 10);
          postsResponse = { posts: feedResponse.posts, has_more: feedResponse.has_more };
        } catch (error) {
          // Fallback to regular posts if enhanced feed fails
          postsResponse = await apiService.getPosts(pageNum * 10, 10);
        }
      } else {
        postsResponse = await apiService.getPosts(pageNum * 10, 10);
      }
      
      battlesResponse = await apiService.getBattles(pageNum * 10, 10);

      // Process posts
      const posts = postsResponse.posts.map(post => ({
        ...post,
        type: 'post',
        user: {
          id: post.author_id,
          username: post.username,
          displayName: post.full_name,
          avatar: post.avatar_url
        },
        image: post.media_urls?.[0],
        timeAgo: formatTimeAgo(post.created_at),
        likeCount: post.likes_count || 0,
        commentCount: post.comments_count || 0,
        isLiked: post.is_liked || false,
        quoteCount: post.quote_count || 0,
        mentionCount: post.mention_count || 0
      }));

      // Process battles
      const battlesMapped = battlesResponse.battles.map(battle => ({
        ...battle,
        type: 'battle',
        creator: battle.creator,
        challengers: battle.participants || [],
        media: battle.media_urls?.map(url => ({ url })) || [],
        voteTotals: battle.vote_counts || { A: 0, B: 0 },
        totalVotes: battle.total_votes || 0,
        userVote: battle.votes?.find(vote => vote.user_id === user?.id)?.choice || null,
        timeLeft: calculateTimeLeft(battle.ends_at),
        timeAgo: formatTimeAgo(battle.created_at)
      }));
      // Hide invitation/status info on Home: only show battles that are live/active for voting
      const battles = battlesMapped.filter(b => (b.status ? b.status === 'LIVE' : b.is_active));

      const combinedItems = [...posts, ...battles]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (pageNum === 0) {
        setFeedItems(combinedItems);
      } else {
        setFeedItems(prev => [...prev, ...combinedItems]);
      }
      
      setHasMore(postsResponse.has_more || battlesResponse.has_more);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching feed:', error);
      showError('Failed to load feed');
    } finally {
      setIsLoadingMore(false);
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const calculateTimeLeft = (endsAt) => {
    if (!endsAt) return 'No time limit';
    
    const now = new Date();
    const end = new Date(endsAt);
    const diffInMs = end - now;
    
    if (diffInMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await apiService.likePost(postId);
      setFeedItems(prev => prev.map(item => 
        item.id === postId && item.type === 'post' 
          ? { 
              ...item, 
              likeCount: response.liked ? item.likeCount + 1 : item.likeCount - 1, 
              isLiked: response.liked 
            }
          : item
      ));
      showSuccess(response.liked ? 'Post liked!' : 'Post unliked!');
    } catch (error) {
      showError('Failed to like post');
    }
  };

  const handleCommentOpen = (postId) => {
    console.log('Open comments for post:', postId);
    // TODO: Implement comment modal
  };

  const handleShare = (itemId) => {
    console.log('Share item:', itemId);
    // TODO: Implement share functionality
  };

  const handleReport = (itemId) => {
    console.log('Report item:', itemId);
    showSuccess('Content reported successfully');
    // TODO: Implement actual report functionality
  };

  const handleVote = async (battleId, choice) => {
    try {
      const response = await apiService.voteBattle(battleId, choice);
      
      setFeedItems(prev => prev.map(item => 
        item.id === battleId && item.type === 'battle'
          ? { 
              ...item, 
              userVote: choice,
              voteTotals: {
                A: choice === 'A' ? item.voteTotals.A + 1 : item.voteTotals.A,
                B: choice === 'B' ? item.voteTotals.B + 1 : item.voteTotals.B
              },
              totalVotes: item.totalVotes + 1
            }
          : item
      ));
      showSuccess('Vote submitted!');
    } catch (error) {
      console.error('Error voting:', error);
      showError('Failed to submit vote');
    }
  };

  const handlePrivateComment = async (battleId, comment) => {
    try {
      await apiService.sendPrivateComment(battleId, comment, []);
      showSuccess('Private comment sent!');
    } catch (error) {
      console.error('Error sending private comment:', error);
      showError(error?.message || 'Failed to send comment');
    }
  };

  const handleReply = async (postId) => {
    try {
      const replyContent = prompt('Write your reply:');
      if (replyContent) {
        await apiService.replyToPost(postId, { content: replyContent });
        showSuccess('Reply posted!');
        fetchFeed(0); // Refresh feed
      }
    } catch (error) {
      showError('Failed to post reply');
    }
  };

  const handleQuote = async (postId) => {
    try {
      const quoteContent = prompt('Add your comment to the quote:');
      if (quoteContent) {
        await apiService.quotePost(postId, { content: quoteContent });
        showSuccess('Quote posted!');
        fetchFeed(0); // Refresh feed
      }
    } catch (error) {
      showError('Failed to post quote');
    }
  };

  const handleRepost = async (postId) => {
    try {
      await apiService.repost(postId);
      showSuccess('Reposted!');
      fetchFeed(0); // Refresh feed
    } catch (error) {
      showError('Failed to repost');
    }
  };

  const handleBattleClick = (battleId) => {
    // Navigate to battle detail page
    navigate(`/battle/${battleId}`);
  };

  if (isLoading) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="max-w-4xl mx-auto p-4">
          <div className="space-y-3 sm:space-y-4">
            {[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
      {/* Top Bar */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white">DaddyBaddy</h1>
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => navigate('/search')}
              className="p-2 text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
            >
              🔍
            </button>
            <button 
              onClick={() => navigate('/notifications')}
              className="relative p-2 text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 pb-20">
        {feedItems.length === 0 ? (
          <Empty
            icon="📱"
            title="No new content yet"
            subtitle="Be the first to create a battle or post something!"
            cta="Create Battle"
          />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {feedItems.map(item => (
              <div key={item.id}>
                {item.type === 'post' ? (
                  <PostCard
                    post={item}
                    onLike={handleLike}
                    onCommentOpen={handleCommentOpen}
                    onShare={handleShare}
                    onReport={handleReport}
                    onReply={handleReply}
                    onQuote={handleQuote}
                    onRepost={handleRepost}
                  />
                ) : (
                  <EnhancedBattleCard
                    battle={item}
                    onVote={handleVote}
                    onPrivateComment={handlePrivateComment}
                    onShare={handleShare}
                    onReport={handleReport}
                    onClick={() => handleBattleClick(item.id)}
                  />
                )}
              </div>
            ))}
            
            {/* Infinite Scroll Sentinel */}
            {hasMore && (
              <div ref={setSentinelRef} className="h-10 flex items-center justify-center">
                {isLoadingMore && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/create')}
        className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl shadow-lg hover:scale-110 active:scale-95 transition-transform z-40 touch-manipulation"
      >
        ➕
      </button>

    </div>
  );
};

// Profile Component - Complete Implementation
const Profile = () => {
  const { user, signOut } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const viewedUsername = params.username || user?.username;
  const isOwnProfile = !params.username || params.username === user?.username;
  const [viewedUser, setViewedUser] = useState(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState('battles');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: user?.username || '',
    fullName: user?.full_name || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || ''
  });
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loadingFollowersList, setLoadingFollowersList] = useState(false);
  const [loadingFollowingList, setLoadingFollowingList] = useState(false);
  // Profile data derived from authenticated user (no dummy values)
  const profile = viewedUser ? {
    id: viewedUser.id,
    username: viewedUser.username,
    fullName: viewedUser.full_name,
    bio: viewedUser.bio,
    location: viewedUser.location,
    website: viewedUser.website,
    avatar: viewedUser.avatar_url || null,
    created_at: viewedUser.created_at
  } : {
    id: user?.id,
    username: user?.username,
    fullName: user?.full_name,
    bio: user?.bio,
    location: user?.location,
    website: user?.website,
    avatar: user?.avatar_url || null,
    created_at: user?.created_at
  };

  // Load user's own content
  const [userBattles, setUserBattles] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!viewedUsername) return;
      if (isOwnProfile) {
        setViewedUser(user);
        if (user?.id) {
          try {
            const fc = await apiService.getFollowCounts(user.id);
            setFollowCounts({ followers: fc.followers || 0, following: fc.following || 0 });
          } catch {}
        }
        return;
      }
      try {
        const res = await apiService.getUserByUsername(viewedUsername);
        setViewedUser(res.user);
        if (res.user?.id) {
          try {
            const fc = await apiService.getFollowCounts(res.user.id);
            setFollowCounts({ followers: fc.followers || 0, following: fc.following || 0 });
          } catch {}
        }
      } catch (e) {
        setViewedUser(null);
      }
    };
    loadUser();
  }, [viewedUsername, isOwnProfile, user]);

  useEffect(() => {
    const load = async () => {
      const uid = profile.id;
      if (!uid) { setUserBattles([]); setUserPosts([]); setLoadingContent(false); return; }
      try {
        const [battlesResp, postsResp] = await Promise.all([
          apiService.getBattles(0, 50),
          apiService.getPosts(0, 50)
        ]);
        const battles = (battlesResp?.battles || battlesResp || []).filter(b => b.creator_id === uid);
        const posts = (postsResp?.posts || postsResp || []).filter(p => (p.author_id === uid));
        setUserBattles(battles);
        setUserPosts(posts);
      } catch (e) {
        setUserBattles([]);
        setUserPosts([]);
      } finally {
        setLoadingContent(false);
      }
    };
    load();
  }, [profile.id]);

  const timeAgo = (iso) => {
    if (!iso) return '';
    const now = Date.now();
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((now - t)/1000));
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  const handleEditSave = async () => {
    try {
      const payload = {
        username: editForm.username,
        full_name: editForm.fullName,
        bio: editForm.bio,
        location: editForm.location,
        website: editForm.website
      };
      const res = await apiService.updateProfile(payload);
      // Reflect changes locally
      if (isOwnProfile && res?.profile) {
        setViewedUser(res.profile);
        try { localStorage.setItem('user', JSON.stringify(res.profile)); } catch {}
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const loadFollowers = async () => {
    if (!profile.id) return;
    setLoadingFollowersList(true);
    try {
      const res = await apiService.getFollowers(profile.id);
      setFollowersList(res.followers || []);
    } catch (error) {
      setFollowersList([]);
    } finally {
      setLoadingFollowersList(false);
    }
  };

  const loadFollowing = async () => {
    if (!profile.id) return;
    setLoadingFollowingList(true);
    try {
      const res = await apiService.getFollowing(profile.id);
      setFollowingList(res.following || []);
    } catch (error) {
      setFollowingList([]);
    } finally {
      setLoadingFollowingList(false);
    }
  };

  const handleFollowToggle = async (userId) => {
    try {
      const res = await apiService.followUser(userId);
      // Update follower count when viewing someone else's profile
      if (!isOwnProfile) {
        setFollowCounts(prev => ({
          followers: Math.max(0, prev.followers + (res.following ? 1 : -1)),
          following: prev.following
        }));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleSettingsSave = async (settings) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Settings saved:', settings);
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const renderBattles = () => (
    <div className="space-y-3 sm:space-y-4">
      {userBattles.length === 0 ? (
        <div className="text-center text-purple-300">No battles yet</div>
      ) : userBattles.map(battle => (
        <div key={battle.id} className="bg-white/5 rounded-lg overflow-hidden">
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-white font-semibold text-sm sm:text-base">{battle.title}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${battle.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{battle.is_active ? 'ongoing' : 'ended'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {battle.image_a_url && (
                <div className="aspect-square bg-gray-800 rounded overflow-hidden">
                  <img src={battle.image_a_url} alt="A" className="w-full h-full object-cover" />
                </div>
              )}
              {battle.image_b_url && (
                <div className="aspect-square bg-gray-800 rounded overflow-hidden">
                  <img src={battle.image_b_url} alt="B" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="text-xs text-purple-300 mt-2">{timeAgo(battle.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPosts = () => (
    <div className={`grid gap-3 sm:gap-4 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
      {userPosts.length === 0 ? (
        <div className="col-span-full text-center text-purple-300">No posts yet</div>
      ) : userPosts.map(post => {
        const image = Array.isArray(post.media_urls) ? post.media_urls[0] : null;
        return (
          <div key={post.id} className="bg-white/5 rounded-lg overflow-hidden">
            <div className="aspect-square bg-gray-800 flex items-center justify-center">
              {image ? (
                <img src={image} alt="Post" className="w-full h-full object-cover" />
              ) : (
                <div className="p-4 text-purple-200 text-sm">{post.content || 'Post'}</div>
              )}
            </div>
            <div className="p-2 sm:p-3">
              <div className="flex items-center justify-between text-xs sm:text-sm text-purple-200">
                <span>{timeAgo(post.created_at)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
            <button
            onClick={() => window.history.back()}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
          >
            ← Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Profile</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
          >
            ⚙️
            </button>
          </div>
        </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {/* Hero Section */}
        <div className="bg-white/5 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Avatar src={profile.avatar} size="2xl" className="flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
          <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {profile.fullName || profile.username}
                  </h2>
                  <p className="text-purple-200 text-sm sm:text-base">@{profile.username}</p>
        </div>

                {!isOwnProfile && (
                  <button
                    onClick={() => handleFollowToggle(profile.id)}
                    className="mt-2 sm:mt-0 px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                  >
                    Follow
                  </button>
                )}
          </div>
              
              {profile.bio && (
                <p className="text-purple-200 text-sm sm:text-base mb-2 sm:mb-3">
                  {profile.bio}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-purple-300">
                {profile.location && (
                  <span>📍 {profile.location}</span>
                )}
                {profile.website && (
                  <a 
                    href={profile.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    🔗 Website
                  </a>
                )}
              </div>

              {/* Join date & follow counts */}
              <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-purple-300 mt-2">
                {profile.created_at && (
                  <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                )}
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setFollowersModalOpen(true);
                    loadFollowers();
                  }}
                  className="underline underline-offset-4 decoration-transparent hover:decoration-purple-200 transition-colors"
                >
                  {followCounts.followers} Followers
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setFollowingModalOpen(true);
                    loadFollowing();
                  }}
                  className="underline underline-offset-4 decoration-transparent hover:decoration-purple-200 transition-colors"
                >
                  {followCounts.following} Following
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/profile/${profile.username}`)}
                  className="ml-2 text-purple-200 hover:text-white"
                  title="Copy profile link"
                >
                  🔗 Share
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats removed until real data is available */}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('battles')}
            className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation ${
              activeTab === 'battles'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            Battles
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation ${
              activeTab === 'posts'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            Posts
          </button>
        </div>

        {/* View Mode Toggle (for posts) */}
        {activeTab === 'posts' && (
          <div className="flex justify-end mb-4">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-xs sm:text-sm transition-colors touch-manipulation ${
                  viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-purple-200 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-xs sm:text-sm transition-colors touch-manipulation ${
                  viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-purple-200 hover:text-white'
                }`}
              >
                List
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'battles' ? renderBattles() : renderPosts()}
      </div>

      {followersModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg sm:text-xl font-semibold">Followers</h3>
              <button
                onClick={() => setFollowersModalOpen(false)}
                className="text-purple-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            {loadingFollowersList ? (
              <div className="text-center text-purple-200 py-6">Loading...</div>
            ) : followersList.length === 0 ? (
              <div className="text-center text-purple-200 py-6">No followers yet.</div>
            ) : (
              <div className="space-y-3">
                {followersList.map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => {
                      setFollowersModalOpen(false);
                      if (follower.username) {
                        navigate(follower.username === user?.username ? '/profile' : `/profile/${follower.username}`);
                      }
                    }}
                    className="w-full flex items-center space-x-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-left transition-colors"
                  >
                    <Avatar src={follower.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm sm:text-base truncate">{follower.full_name || follower.username}</div>
                      <div className="text-purple-200 text-xs sm:text-sm truncate">@{follower.username}</div>
                      {follower.bio && (
                        <div className="text-purple-300 text-xs mt-1 line-clamp-2">{follower.bio}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {followingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg sm:text-xl font-semibold">Following</h3>
              <button
                onClick={() => setFollowingModalOpen(false)}
                className="text-purple-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            {loadingFollowingList ? (
              <div className="text-center text-purple-200 py-6">Loading...</div>
            ) : followingList.length === 0 ? (
              <div className="text-center text-purple-200 py-6">Not following anyone yet.</div>
            ) : (
              <div className="space-y-3">
                {followingList.map((followee) => (
                  <button
                    key={followee.id}
                    onClick={() => {
                      setFollowingModalOpen(false);
                      if (followee.username) {
                        navigate(followee.username === user?.username ? '/profile' : `/profile/${followee.username}`);
                      }
                    }}
                    className="w-full flex items-center space-x-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-left transition-colors"
                  >
                    <Avatar src={followee.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm sm:text-base truncate">{followee.full_name || followee.username}</div>
                      <div className="text-purple-200 text-xs sm:text-sm truncate">@{followee.username}</div>
                      {followee.bio && (
                        <div className="text-purple-300 text-xs mt-1 line-clamp-2">{followee.bio}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-4 text-lg sm:text-xl">Edit Profile</h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-purple-200 text-xs sm:text-sm mb-1">Username</label>
            <input
              type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
            />
          </div>
          
          <div>
                <label className="block text-purple-200 text-xs sm:text-sm mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-purple-200 text-xs sm:text-sm mb-1">Bio</label>
            <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base resize-none"
            />
          </div>
          
            <div>
                <label className="block text-purple-200 text-xs sm:text-sm mb-1">Location</label>
              <input
                type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
              />
            </div>
            
            <div>
                <label className="block text-purple-200 text-xs sm:text-sm mb-1">Website</label>
                <input
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
                />
              </div>
            </div>
            
            <div className="flex space-x-2 sm:space-x-3 mt-4 sm:mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
              >
                Save
              </button>
            </div>
          </div>
          </div>
        )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
          onEditProfile={() => {
            setShowSettings(false);
            setIsEditing(true);
          }}
          onSignOut={signOut}
        />
      )}
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ onClose, onSave, onEditProfile, onSignOut }) => {
  const [settings, setSettings] = useState({
    privacy: 'public',
    notifications: {
      likes: true,
      comments: true,
      follows: true,
      battles: true
    }
  });

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 w-full max-w-md">
        <h3 className="text-white font-semibold mb-4 text-lg sm:text-xl">Settings</h3>
        
        <div className="space-y-4 sm:space-y-6">
          {/* Privacy Settings */}
          <div>
            <h4 className="text-white font-medium mb-3 text-sm sm:text-base">Privacy</h4>
            <div className="space-y-2">
              {[
                { value: 'public', label: 'Public', desc: 'Anyone can see your profile and battles' },
                { value: 'followers', label: 'Followers Only', desc: 'Only followers can see your content' },
                { value: 'private', label: 'Private', desc: 'Only you can see your content' }
              ].map(option => (
                <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    value={option.value}
                    checked={settings.privacy === option.value}
                    onChange={(e) => setSettings({...settings, privacy: e.target.value})}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-white text-sm sm:text-base">{option.label}</div>
                    <div className="text-purple-200 text-xs sm:text-sm">{option.desc}</div>
                  </div>
              </label>
              ))}
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <h4 className="text-white font-medium mb-3 text-sm sm:text-base">Notifications</h4>
            <div className="space-y-3">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-purple-200 text-sm sm:text-base capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
              <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          [key]: e.target.checked
                        }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3 pt-4 border-t border-white/10">
            <button
              onClick={onEditProfile}
              className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
            >
              Edit Profile
            </button>
            <button
              onClick={onSignOut}
              className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        <div className="flex space-x-2 sm:space-x-3 mt-4 sm:mt-6">
          <button
              onClick={onClose}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
            >
            Close
            </button>
            <button
            onClick={handleSave}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm sm:text-base transition-colors touch-manipulation"
            >
            Save Settings
            </button>
          </div>
      </div>
    </div>
  );
};

// Search Component - Complete Implementation
const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, users, battles, posts
  const [recentSearches, setRecentSearches] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mock data for demonstration
  const mockUsers = [
    {
      id: 'user1',
      username: 'john_doe',
      fullName: 'John Doe',
      avatar: null,
      bio: 'Photography enthusiast',
      followers: 1250,
      isFollowing: false
    },
    {
      id: 'user2',
      username: 'photo_pro',
      fullName: 'Photo Pro',
      avatar: null,
      bio: 'Professional photographer',
      followers: 3400,
      isFollowing: true
    },
    {
      id: 'user3',
      username: 'battle_master',
      fullName: 'Battle Master',
      avatar: null,
      bio: 'Battle creator and judge',
      followers: 890,
      isFollowing: false
    }
  ];

  const mockBattles = [
    {
      id: 'battle1',
      title: 'Sunset Photography Battle',
      creator: { username: 'photo_pro', avatar: null },
      challengers: [{ username: 'john_doe', avatar: null }],
      media: [
        { url: 'https://picsum.photos/200/200?random=1' },
        { url: 'https://picsum.photos/200/200?random=2' }
      ],
      status: 'ongoing',
      voteTotals: { A: 45, B: 32 },
      totalVotes: 77,
      hashtags: ['#photography', '#sunset', '#battle']
    },
    {
      id: 'battle2',
      title: 'Street Art Challenge',
      creator: { username: 'art_lover', avatar: null },
      challengers: [{ username: 'creative_soul', avatar: null }],
      media: [
        { url: 'https://picsum.photos/200/200?random=3' }
      ],
      status: 'expired',
      voteTotals: { A: 28, B: 15 },
      totalVotes: 43,
      hashtags: ['#streetart', '#urban', '#creative']
    }
  ];

  const mockPosts = [
    {
      id: 'post1',
      user: { username: 'john_doe', avatar: null },
      image: 'https://picsum.photos/400/300?random=4',
      timeAgo: '2h ago',
      likeCount: 42,
      commentCount: 8,
      hashtags: ['#photography', '#nature']
    },
    {
      id: 'post2',
      user: { username: 'photo_pro', avatar: null },
      image: 'https://picsum.photos/400/300?random=5',
      timeAgo: '1d ago',
      likeCount: 156,
      commentCount: 23,
      hashtags: ['#portrait', '#professional']
    }
  ];

  const mockTrendingHashtags = [
    { tag: '#photography', count: 1250 },
    { tag: '#battle', count: 890 },
    { tag: '#art', count: 670 },
    { tag: '#creative', count: 540 },
    { tag: '#nature', count: 420 }
  ];

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
    
    // Load trending hashtags
    setTrendingHashtags(mockTrendingHashtags);
  }, []);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setSearchQuery(query);
    
    try {
      const [usersResponse, battlesResponse, postsResponse] = await Promise.all([
        apiService.searchUsers(query, 0, 10),
        apiService.searchBattles(query, 0, 10),
        apiService.searchPosts(query, 0, 10)
      ]);
      
      setSearchResults({
        users: usersResponse.users,
        battles: battlesResponse.battles,
        posts: postsResponse.posts
      });
      
      // Add to recent searches
      const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('recentSearches', JSON.stringify(newRecent));
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHashtagClick = (hashtag) => {
    setSearchQuery(hashtag);
    handleSearch(hashtag);
  };

  const handleUserFollow = async (userId) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Follow toggled for user:', userId);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
  };

  const renderSearchResults = () => {
    if (!searchQuery) return null;

    const results = searchResults;
    const hasResults = results.users?.length > 0 || results.battles?.length > 0 || results.posts?.length > 0;

    if (isLoading) {
    return (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

    if (!hasResults) {
      return (
        <Empty
          icon="🔍"
          title="No results found"
          subtitle={`No results for "${searchQuery}". Try different keywords or hashtags.`}
        />
      );
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Users */}
        {results.users?.length > 0 && (activeTab === 'all' || activeTab === 'users') && (
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Users</h3>
            <div className="space-y-2 sm:space-y-3">
              {results.users.map(user => (
                <UserRow
                  key={user.id}
                  user={user}
                  rank={null}
                  onFollowToggle={handleUserFollow}
                  isFollowing={user.isFollowing}
                />
              ))}
            </div>
          </div>
        )}

        {/* Battles */}
        {results.battles?.length > 0 && (activeTab === 'all' || activeTab === 'battles') && (
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Battles</h3>
            <div className="space-y-3 sm:space-y-4">
              {results.battles.map(battle => (
                <div key={battle.id} className="bg-white/5 rounded-lg overflow-hidden">
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h4 className="text-white font-semibold text-sm sm:text-base">{battle.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        battle.status === 'ongoing' ? 'bg-green-500' : 'bg-red-500'
                      } text-white`}>
                        {battle.status}
                      </span>
                    </div>
                    
                    <div className={`grid gap-1 ${battle.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {battle.media.map((media, index) => (
                        <div key={index} className="aspect-square bg-gray-800 rounded">
                          <img 
                            src={media.url} 
                            alt={`Battle media ${index + 1}`} 
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-2 sm:mt-3">
                      <VoteMeter
                        totals={battle.voteTotals}
                        myVoteUserId={null}
                        participantA={battle.creator}
                        participantB={battle.challengers[0]}
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
                      {battle.hashtags.map(tag => (
                        <span 
                          key={tag}
                          onClick={() => handleHashtagClick(tag)}
                          className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs cursor-pointer hover:bg-purple-600/30 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        {results.posts?.length > 0 && (activeTab === 'all' || activeTab === 'posts') && (
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Posts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {results.posts.map(post => (
                <div key={post.id} className="bg-white/5 rounded-lg overflow-hidden">
                  <div className="aspect-square bg-gray-800">
                    <img 
                      src={post.image} 
                      alt="Post" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 sm:p-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-purple-200 mb-1">
                      <span>@{post.user.username}</span>
                      <span>{post.timeAgo}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm text-purple-300">
                      <span>❤️ {post.likeCount}</span>
                      <span>💬 {post.commentCount}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {post.hashtags.map(tag => (
                        <span 
                          key={tag}
                          onClick={() => handleHashtagClick(tag)}
                          className="px-1 py-0.5 bg-purple-600/20 text-purple-300 rounded text-xs cursor-pointer hover:bg-purple-600/30 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSuggestions = () => {
    if (!showSuggestions || searchQuery) return null;

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Recent Searches</h3>
            <div className="space-y-2">
              {recentSearches.map((search, index) => (
            <button
                  key={index}
                  onClick={() => {
                    setSearchQuery(search);
                    handleSearch(search);
                  }}
                  className="w-full text-left p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-purple-300">🕒</span>
                    <span className="text-white text-sm sm:text-base">{search}</span>
                  </div>
            </button>
              ))}
          </div>
          </div>
        )}

        {/* Trending Hashtags */}
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm sm:text-base">Trending Hashtags</h3>
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => handleHashtagClick(tag)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors touch-manipulation"
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto p-3 sm:p-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={() => window.history.back()}
              className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
            >
              ← Back
            </button>
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value);
                  if (value.trim()) {
                    handleSearch(value);
                  } else {
                    setSearchResults([]);
                    setShowSuggestions(true);
                  }
                }}
                onClear={clearSearch}
                placeholder="Search users, battles, posts, or hashtags..."
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {/* Search Tabs */}
        {searchQuery && (
          <div className="flex space-x-1 mb-4 sm:mb-6">
            {[
              { id: 'all', label: 'All' },
              { id: 'users', label: 'Users' },
              { id: 'battles', label: 'Battles' },
              { id: 'posts', label: 'Posts' }
            ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                {tab.label}
            </button>
            ))}
          </div>
        )}

        {/* Search Results or Suggestions */}
        {searchQuery ? renderSearchResults() : renderSuggestions()}
        </div>
    </div>
  );
};

// Bottom Navigation Component
const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // Hide bottom navigation until user is authenticated
  if (loading || !user) {
    return null;
  }
  
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠', path: '/' },
    { id: 'ranking', label: 'Ranking', icon: '🏆', path: '/ranking' },
    { id: 'create', label: 'Create', icon: '➕', path: '/create' },
    { id: 'chats', label: 'Chats', icon: '💬', path: '/chats' },
    { id: 'profile', label: 'Profile', icon: '👤', path: '/profile' }
  ];

  const handleTabClick = (path) => {
    navigate(path);
  };

  const isActiveTab = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

    return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-sm border-t border-white/20 z-50">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.path)}
              className={`flex flex-col items-center justify-center py-2 sm:py-3 px-1 transition-colors touch-manipulation ${
                isActiveTab(tab.path)
                  ? 'text-purple-400'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              <span className="text-lg sm:text-xl mb-1">{tab.icon}</span>
              <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      </div>
    );
};

// Ranking/Leaderboard Component - Complete Implementation
const Ranking = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ranking');
  const [timeFilter, setTimeFilter] = useState('weekly');
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [battles, setBattles] = useState([]);
  const { showSuccess, showError } = useToast();

  // Mock data for users
  const mockUsers = [
    {
      id: '1',
      rank: 1,
      username: 'photo_master',
      displayName: 'Photo Master',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      wins: 45,
      losses: 12,
      winRate: 78.9,
      totalBattles: 57,
      isFollowing: false
    },
    {
      id: '2',
      rank: 2,
      username: 'art_genius',
      displayName: 'Art Genius',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      wins: 38,
      losses: 15,
      winRate: 71.7,
      totalBattles: 53,
      isFollowing: true
    },
    {
      id: '3',
      rank: 3,
      username: 'creative_vision',
      displayName: 'Creative Vision',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      wins: 32,
      losses: 18,
      winRate: 64.0,
      totalBattles: 50,
      isFollowing: false
    },
    {
      id: '4',
      rank: 4,
      username: 'lens_artist',
      displayName: 'Lens Artist',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      wins: 28,
      losses: 22,
      winRate: 56.0,
      totalBattles: 50,
      isFollowing: true
    },
    {
      id: '5',
      rank: 5,
      username: 'visual_storyteller',
      displayName: 'Visual Storyteller',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      wins: 25,
      losses: 25,
      winRate: 50.0,
      totalBattles: 50,
      isFollowing: false
    }
  ];

  // Mock data for trending battles
  const mockBattles = [
    {
      id: 'battle1',
      title: 'Sunset Photography Challenge',
      creator: {
        username: 'photo_master',
        displayName: 'Photo Master',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      },
      participants: 2,
      totalVotes: 156,
      timeLeft: '2h 15m',
      status: 'ongoing',
      media: [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop'
      ]
    },
    {
      id: 'battle2',
      title: 'Street Art Battle',
      creator: {
        username: 'art_genius',
        displayName: 'Art Genius',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
      },
      participants: 2,
      totalVotes: 89,
      timeLeft: '5h 30m',
      status: 'ongoing',
      media: [
        'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=300&fit=crop',
        'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=300&fit=crop'
      ]
    },
    {
      id: 'battle3',
      title: 'Portrait Photography',
      creator: {
        username: 'creative_vision',
        displayName: 'Creative Vision',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
      },
      participants: 2,
      totalVotes: 203,
      timeLeft: '1d 3h',
      status: 'ongoing',
      media: [
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300&h=300&fit=crop',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop'
      ]
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersResponse, battlesResponse] = await Promise.all([
        apiService.getUsers(0, 20),
        apiService.getBattles(0, 20, 'ongoing')
      ]);
      
      setUsers(Array.isArray(usersResponse?.users) ? usersResponse.users : []);
      setBattles(Array.isArray(battlesResponse?.battles) ? battlesResponse.battles : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async (userId) => {
    try {
      const response = await apiService.followUser(userId);
      
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: response.following }
          : user
      ));
      
      showSuccess(response.following ? 'Following' : 'Unfollowed');
    } catch (error) {
      showError('Failed to update follow status');
    }
  };

  const q = (searchQuery || '').toLowerCase();
  const filteredUsers = (users || []).filter(user => {
    const uname = (user.username || '').toLowerCase();
    const dname = (user.displayName || user.full_name || '').toLowerCase();
    return uname.includes(q) || dname.includes(q);
  });

  const filteredBattles = (battles || []).filter(battle => {
    const title = (battle.title || '').toLowerCase();
    const creator = (battle.creator?.username || battle.creator?.full_name || '').toLowerCase();
    return title.includes(q) || creator.includes(q);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
        <div className="max-w-4xl mx-auto p-4">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/20 rounded w-1/3"></div>
                    <div className="h-3 bg-white/20 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
          <button 
            onClick={() => window.history.back()}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
          >
            ← Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Ranking</h1>
          <div></div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search usernames or #hashtags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-300 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-4">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'ranking'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            Ranking
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'leaderboard'
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* Time Filter for Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setTimeFilter('weekly')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeFilter === 'weekly'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTimeFilter('alltime')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeFilter === 'alltime'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              All-time
            </button>
          </div>
        )}

        {/* Content */}
        {activeTab === 'ranking' ? (
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <Empty
                icon="🏆"
                title="No users found"
                subtitle="Try a different search term"
              />
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="bg-white/5 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-purple-400 w-8">
                        #{user.rank}
                      </span>
                      <Avatar src={user.avatar} size="md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-medium text-sm sm:text-base">
                            {user.displayName}
                          </h3>
                          <p className="text-purple-300 text-xs">@{user.username}</p>
                        </div>
                        <button
                          onClick={() => handleFollowToggle(user.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            user.isFollowing
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/10 text-purple-200 hover:bg-white/20'
                          }`}
                        >
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </button>
                      </div>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{user.wins ?? 0}</p>
                          <p className="text-purple-300 text-xs">Wins</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{user.losses ?? 0}</p>
                          <p className="text-purple-300 text-xs">Losses</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{(user.winRate ?? user.win_rate ?? 0)}%</p>
                          <p className="text-purple-300 text-xs">W/L%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{user.totalBattles ?? user.total_battles ?? 0}</p>
                          <p className="text-purple-300 text-xs">Battles</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBattles.length === 0 ? (
              <Empty
                icon="⚔️"
                title="No battles found"
                subtitle="Try a different search term"
              />
            ) : (
              filteredBattles.map(battle => (
                <div key={battle.id} className="bg-white/5 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center space-x-3">
                    <div className="grid grid-cols-2 gap-1 w-16 h-16 rounded-lg overflow-hidden">
                      {((Array.isArray(battle.media) ? battle.media : (Array.isArray(battle.media_urls) ? battle.media_urls : [])) || [])
                        .filter(Boolean)
                        .slice(0,4)
                        .map((media, index) => {
                          const src = typeof media === 'string' ? media : media.url;
                          return (
                        <img
                          key={index}
                          src={src}
                          alt={`Battle media ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                          );
                        })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm sm:text-base truncate">
                        {battle.title}
                      </h3>
                      <p className="text-purple-300 text-xs">
                        by @{battle.creator?.username || battle.creator?.full_name || 'unknown'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{battle.totalVotes ?? ((battle.vote_counts?.A || 0) + (battle.vote_counts?.B || 0))}</p>
                          <p className="text-purple-300 text-xs">Votes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{Array.isArray(battle.participants) ? battle.participants.length : (battle.participants ?? 0)}</p>
                          <p className="text-purple-300 text-xs">Players</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-medium text-sm">{battle.timeLeft || ''}</p>
                          <p className="text-purple-300 text-xs">Left</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (battle.status ? battle.status === 'ongoing' : battle.is_active) 
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {battle.status || (battle.is_active ? 'ongoing' : 'ended')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Create Battle Component - Stepper Implementation (no dummy users)
const CreateBattle = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    challengers: [],
    photos: [],
    audience: 'public',
    title: '',
    description: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { showSuccess, showError } = useToast();

  const [mode, setMode] = useState(null); // '1v1' | 'multi'
  const steps = [
    { id: 1, title: 'Select Type', icon: '⚙️' },
    { id: 2, title: mode === 'multi' ? 'Invite Users' : 'Select Opponent', icon: '👥' },
    { id: 3, title: 'Confirm', icon: '✅' }
  ];

  // Live search for users from backend
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = (searchQuery || '').trim();
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const resp = await apiService.getUsers(0, 20, q);
        // apiService.getUsers signature is (skip, limit, search); adapt if needed
        const list = Array.isArray(resp?.users) ? resp.users : Array.isArray(resp) ? resp : resp?.data || [];
        if (!cancelled) setSearchResults(list);
      } catch (_) {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChallengerToggle = (user) => {
    setFormData(prev => ({
      ...prev,
      challengers: prev.challengers.some(c => c.id === user.id)
        ? prev.challengers.filter(c => c.id !== user.id)
        : [...prev.challengers, user]
    }));
  };

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos]
    }));
  };

  const handlePhotoRemove = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(photo => photo.id !== photoId)
    }));
  };

  const handleSubmit = async () => {
    // Send invites according to mode, do not upload yet
    if (!mode) { showError('Select a battle type'); return; }
    if (mode === '1v1' && formData.challengers.length !== 1) { showError('Select exactly one opponent'); return; }
    if (mode === 'multi' && formData.challengers.length < 2) { showError('Invite at least two users'); return; }
    setIsCreating(true);
    try {
      const payload = {
        title: formData.title || 'Untitled Battle',
        description: formData.description || '',
        mode,
        invited_user_ids: formData.challengers.map(c => c.id),
        visibility: formData.audience
      };
      await apiService.createUserBattle(payload);
      showSuccess('Invites sent. Acceptance window is 2h.');
    } catch (error) {
      showError(error?.message || 'Failed to create battle');
    } finally {
      setIsCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!mode;
      case 2:
        return mode === '1v1' ? formData.challengers.length === 1 : formData.challengers.length >= 2;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('1v1')}
                className={`p-4 rounded-lg border ${mode==='1v1' ? 'border-purple-500 bg-purple-600/20' : 'border-white/20 bg-white/5 hover:bg-white/10'} text-left`}
              >
                <div className="text-2xl mb-2">👤 vs 👤</div>
                <div className="text-white font-medium">1 vs 1 Battle</div>
                <div className="text-purple-300 text-sm">Invite exactly one opponent</div>
              </button>
              <button
                onClick={() => setMode('multi')}
                className={`p-4 rounded-lg border ${mode==='multi' ? 'border-purple-500 bg-purple-600/20' : 'border-white/20 bg-white/5 hover:bg-white/10'} text-left`}
              >
                <div className="text-2xl mb-2">👥</div>
                <div className="text-white font-medium">Multi-User Battle</div>
                <div className="text-purple-300 text-sm">Invite multiple users (2–4 total)</div>
              </button>
            </div>
            <div className="text-purple-300 text-sm">Select a mode to continue.</div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder={mode==='1v1' ? 'Search opponent...' : 'Search users to invite...'}
                value={searchQuery ?? ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300">🔍</span>
            </div>

            <div className="space-y-2">
              {isSearching && (<div className="text-purple-300 text-sm">Searching...</div>)}
              {!isSearching && searchResults.length === 0 && (
                <div className="text-purple-300 text-sm">{(searchQuery||'').trim().length < 2 ? 'Type at least 2 characters to search users' : 'No users found'}</div>
              )}
              {searchResults.map(user => {
                const displayName = user.full_name || user.username || 'User';
                const username = user.username || (displayName || '').toLowerCase().replace(/\s+/g, '');
                const avatar = user.avatar_url || null;
                const normalized = { id: user.id, displayName, username, avatar, isOnline: false };
                return (
                  <div
                    key={normalized.id}
                    onClick={() => handleChallengerToggle(normalized)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      formData.challengers.some(c => c.id === normalized.id)
                        ? 'bg-purple-600/20 border-2 border-purple-500'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar src={avatar} size="md" />
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{displayName}</h3>
                        <p className="text-purple-300 text-sm">@{username}</p>
                      </div>
                      {formData.challengers.some(c => c.id === normalized.id) && (<span className="text-purple-400">✓</span>)}
                    </div>
                  </div>
                );
              })}
            </div>

            {formData.challengers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-white font-medium mb-2">Selected {mode==='1v1' ? 'Opponent' : 'Users'}:</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.challengers.map(challenger => (
                    <div key={challenger.id} className="flex items-center space-x-2 bg-purple-600/20 px-3 py-1 rounded-full">
                      <span className="text-white text-sm">{challenger.displayName}</span>
                      <button onClick={() => handleChallengerToggle(challenger)} className="text-purple-300 hover:text-white">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {[
                { value: 'public', label: 'Public', description: 'Anyone can see and vote', icon: '🌍' },
                { value: 'followers', label: 'Followers', description: 'Only your followers can see', icon: '👥' },
                { value: 'close_friends', label: 'Close Friends', description: 'Only close friends can see', icon: '💜' }
              ].map(option => (
                <div
                  key={option.value}
                  onClick={() => setFormData(prev => ({ ...prev, audience: option.value }))}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    formData.audience === option.value
                      ? 'bg-purple-600/20 border-2 border-purple-500'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <h3 className="text-white font-medium">{option.label}</h3>
                      <p className="text-purple-300 text-sm">{option.description}</p>
                    </div>
                    {formData.audience === option.value && (
                      <span className="text-purple-400 ml-auto">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Battle Summary</h3>
              
              <div className="space-y-3">
                <div>
                  <p className="text-purple-300 text-sm">Challengers:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.challengers.map(challenger => (
                      <div key={challenger.id} className="flex items-center space-x-2">
                        <Avatar src={challenger.avatar} size="sm" />
                        <span className="text-white text-sm">{challenger.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-purple-300 text-sm">Photos:</p>
                  <p className="text-white">{formData.photos.length} photos uploaded</p>
                </div>

                <div>
                  <p className="text-purple-300 text-sm">Audience:</p>
                  <p className="text-white capitalize">{formData.audience.replace('_', ' ')}</p>
                </div>
              </div>
            </div>

            <div className="text-center text-purple-300 text-sm">
              <p>Battle will start when at least one challenger accepts</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
            <button
            onClick={() => window.history.back()}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
            >
            ← Back
            </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Create Battle</h1>
          <div></div>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-300'
              }`}>
                {currentStep > step.id ? '✓' : step.id}
              </div>
              <div className="ml-2 hidden sm:block">
                <p className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-white' : 'text-purple-300'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  currentStep > step.id ? 'bg-purple-600' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white/5 rounded-lg p-4 sm:p-6 mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
            <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-6 py-3 bg-white/10 text-purple-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
            >
            Back
            </button>

          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isCreating}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Battle'}
            </button>
          )}
          </div>
        </div>
    </div>
  );
};

// Chats Component - Complete Implementation
const Chats = () => {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/initials/svg?seed=ChatMate';

  const resolveCurrentUserId = () => {
    if (user?.id) return user.id;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.id || null;
      }
    } catch (_) {}
    return null;
  };

  const formatChatTimestamp = (isoString) => {
    if (!isoString) return 'Just now';
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return 'Just now';
    const diffMs = Date.now() - parsed.getTime();
    if (diffMs < 60 * 1000) return 'Just now';
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
    return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
  };

  const normalizeChatRoom = (room) => {
    if (!room || !room.id) return null;

    const roomType = (room.room_type || '').toLowerCase();
    const baseName = room.name || 'Community Chat';
    const defaultUsername = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const timestampSource = room.last_message_at || room.updated_at || room.created_at;

    let userIdForCard = room.peer_user_id || (room.created_by && room.created_by !== user?.id ? room.created_by : room.id);
    let displayName = room.peer_display_name || baseName;
    let username = room.peer_username || defaultUsername;
    let avatar = room.peer_avatar || room.avatar_url || DEFAULT_AVATAR;
    let lastMessageText = room.last_message || room.description || 'Say hello and start the conversation';
    let lastMessageSender = room.last_message_sender_id || room.peer_user_id || room.created_by || room.id;

    if (roomType === 'direct') {
      const fallbackName = room.peer_display_name || room.peer_username || 'Direct Chat';
      displayName = fallbackName;
      username = room.peer_username || fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      avatar = room.peer_avatar || DEFAULT_AVATAR;
      userIdForCard = room.peer_user_id || room.created_by;
      lastMessageText = room.last_message || 'Say hello and start the conversation';
      lastMessageSender = room.last_message_sender_id || room.peer_user_id || room.created_by;
    }

    return {
      id: room.id,
      roomType,
      user: {
        id: userIdForCard,
        username,
        displayName,
        avatar,
        isOnline: Boolean(room.room_type && room.room_type !== 'archived')
      },
      lastMessage: {
        text: lastMessageText,
        timestamp: formatChatTimestamp(timestampSource),
        isRead: true,
        senderId: lastMessageSender
      },
      unreadCount: 0,
      updatedAt: new Date(timestampSource || Date.now())
    };
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchChats();
    fetchSuggestions();
  }, [user?.id]);

  const fetchChats = async () => {
    try {
      const response = await apiService.getChats();
      const normalized = (response?.chats || [])
        .map(normalizeChatRoom)
        .filter(Boolean);
      setChats(normalized);
    } catch (error) {
      console.error('Error fetching chats:', error);
      showError('Failed to load chats');
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMutualFollowerSuggestions = async (limit = 12) => {
    if (!user?.id) return [];

    const [following, followers] = await Promise.all([
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .limit(1000),
      supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .limit(1000)
    ]);

    if (following.error) throw following.error;
    if (followers.error) throw followers.error;

    const followingSet = new Set(
      (following.data || [])
        .map(row => row.following_id)
        .filter(Boolean)
    );
    const followerSet = new Set(
      (followers.data || [])
        .map(row => row.follower_id)
        .filter(Boolean)
    );

    const mutualIds = Array.from(followingSet).filter(id => followerSet.has(id) && id !== user.id);
    if (!mutualIds.length) return [];

    const limitedIds = mutualIds.slice(0, limit);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,bio')
      .in('id', limitedIds);

    if (profilesError) throw profilesError;
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    return limitedIds.map(id => profileMap.get(id)).filter(Boolean);
  };

  const fetchSuggestions = async () => {
    try {
      const suggestionList = await fetchMutualFollowerSuggestions(12);
      setSuggestions(suggestionList);
    } catch (fallbackError) {
      console.error('Unable to load chat suggestions:', fallbackError);
      setSuggestions([]);
    } finally {
      setIsSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat.id);
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat?.id) return;
    const interval = setInterval(() => {
      fetchMessages(activeChat.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChat?.id]);

  const fetchMessages = async (chatId) => {
    try {
      const response = await apiService.getMessages(chatId, 0, 50);
      const list = Array.isArray(response?.messages) ? response.messages : [];
      const normalizedMessages = list.map(msg => ({
        ...msg,
        text: msg.content || msg.message || '',
        senderId: msg.sender_id || msg.user_id,
        timestamp: formatChatTimestamp(msg.created_at)
      }));
      setMessages([...normalizedMessages].reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Error fetching messages:', error);
      showError('Failed to load messages');
    }
  };

  const handleMessageClick = async (profile) => {
    if (!profile?.id) return;

    const currentUserId = resolveCurrentUserId();
    if (!currentUserId) {
      showError('Please sign in to start a chat.');
      return;
    }

    if (profile.id === currentUserId) {
      showError('You cannot start a chat with yourself.');
      return;
    }

    const existingChat = chats.find(chat => chat?.user?.id === profile.id);
    if (existingChat) {
      setActiveChat(existingChat);
      return;
    }
    try {
      const response = await apiService.createDirectChat(profile.id);
      const rawChat = response?.chat;
      const normalizedChat = normalizeChatRoom(rawChat);
      if (!normalizedChat) {
        throw new Error('Failed to open chat');
      }

      setChats(prev => {
        const alreadyExists = prev.some(chat => chat.id === normalizedChat.id);
        if (alreadyExists) {
          return prev;
        }
        return [normalizedChat, ...prev];
      });

      setActiveChat(normalizedChat);
      setMessages([]);
      setNewMessage('');
    } catch (error) {
      console.error('Error starting direct chat:', error);
      const detail = error?.message || '';
      if (detail.toLowerCase().includes('cannot start a chat with yourself')) {
        showError('You cannot start a chat with yourself.');
      } else {
        showError('Unable to open chat. Please try again.');
      }
    }
  };

  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    // Mark messages as read
    setChats(prev => prev.map(c => 
      c.id === chat.id ? { ...c, unreadCount: 0 } : c
    ));
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    if (!activeChat?.id) {
      showError('Select a chat to send a message.');
      return;
    }

    setIsSending(true);
    try {
      const response = await apiService.sendMessage(activeChat.id, newMessage.trim());
      const rawMessage = response?.message || {};

      const message = {
        ...rawMessage,
        text: rawMessage.content || rawMessage.message || newMessage.trim(),
        timestamp: rawMessage.created_at ? formatChatTimestamp(rawMessage.created_at) : 'now',
        senderId: rawMessage.sender_id || rawMessage.user_id || user?.id,
        isRead: true
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');

      // Update last message in chats
      setChats(prev => prev.map(c => 
        c.id === activeChat.id 
          ? { 
              ...c, 
              lastMessage: {
                text: message.text,
                timestamp: 'now',
                isRead: true,
                senderId: 'current_user'
              },
              updatedAt: new Date()
            }
          : c
      ));

      showSuccess('Message sent!');
      await fetchMessages(activeChat.id);
    } catch (error) {
      showError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = chats.filter(chat => {
    const username = (chat?.user?.username || '').toLowerCase();
    const displayName = (chat?.user?.displayName || '').toLowerCase();
    const lastText = (chat?.lastMessage?.text || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return username.includes(query) || displayName.includes(query) || lastText.includes(query);
  });

  const currentUserId = resolveCurrentUserId();

  const existingChatUserIds = new Set(
    chats
      .map(chat => chat?.user?.id)
      .filter(id => id && id !== currentUserId)
  );

  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.id !== currentUserId && !existingChatUserIds.has(suggestion.id)
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
        <div className="max-w-4xl mx-auto p-4">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/20 rounded w-1/3"></div>
                    <div className="h-3 bg-white/20 rounded w-2/3"></div>
        </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat List View
  if (!activeChat) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
      {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
            <button
              onClick={() => window.history.back()}
              className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
            >
              ← Back
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Chats</h1>
            <button className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation">
              ✏️
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto p-3 sm:p-4">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300">
              🔍
            </span>
            {searchQuery && (
            <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-300 hover:text-white"
            >
                ✕
            </button>
            )}
          </div>

          {/* Suggested Contacts */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold text-sm sm:text-base">Suggested chats</h2>
              {!isSuggestionsLoading && filteredSuggestions.length > 0 && (
                <span className="text-purple-200 text-xs">Based on mutual follows</span>
              )}
            </div>
            {isSuggestionsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="min-w-[110px] bg-white/5 border border-white/10 rounded-lg p-3 animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-white/20 mx-auto mb-2"></div>
                    <div className="h-3 bg-white/20 rounded w-3/4 mx-auto"></div>
                  </div>
                ))}
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <p className="text-purple-200 text-xs">No mutual followers to suggest right now.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {filteredSuggestions.map(profile => (
                  <div
                    key={profile.id}
                    className="relative min-w-[160px] bg-white/5 border border-white/10 rounded-lg p-3 text-left transition-colors hover:bg-white/10"
                  >
                    <button
                      onClick={() => handleMessageClick(profile)}
                      className="absolute top-2 right-2 px-2 py-1 rounded-full bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                      Message
                    </button>
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Avatar src={profile.avatar_url || DEFAULT_AVATAR} size="sm" />
                      <div className="text-white text-sm font-semibold truncate w-full">
                        {profile.full_name || profile.username || 'New Friend'}
                      </div>
                      <div className="text-purple-200 text-xs truncate w-full">
                        @{profile.username || (profile.full_name || 'friend').toLowerCase().replace(/[^a-z0-9]+/g, '')}
                      </div>
                      <div className="text-purple-300 text-[10px] break-all leading-tight w-full">
                        ID: {profile.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chats List */}
          {filteredChats.length === 0 ? (
            <Empty
              icon="💬"
              title={searchQuery ? "No conversations found" : "No conversations yet"}
              subtitle={searchQuery ? "Try a different search term" : "Start a conversation with someone!"}
            />
          ) : (
            <div className="space-y-2">
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => handleChatSelect(chat)}
                  className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 cursor-pointer transition-colors touch-manipulation"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar src={chat.user.avatar} size="md" />
                      {chat.user.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-purple-900"></div>
                      )}
        </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium text-sm sm:text-base truncate">
                          {chat.user.displayName}
                        </h3>
                        <span className="text-purple-300 text-xs">
                          {chat.lastMessage.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-purple-200 text-xs sm:text-sm truncate">
                          {chat.lastMessage.senderId === 'current_user' ? 'You: ' : ''}
                          {chat.lastMessage.text}
                        </p>
                        {chat.unreadCount > 0 && (
                          <div className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-2 flex-shrink-0">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat Thread View
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex flex-col pb-24 sm:pb-28">
      {/* Chat Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center p-3 sm:p-4">
            <button
            onClick={() => setActiveChat(null)}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation mr-3"
            >
            ←
            </button>
          <div className="flex items-center space-x-3 flex-1">
            <div className="relative">
              <Avatar src={activeChat.user.avatar} size="md" />
              {activeChat.user.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-purple-900"></div>
              )}
            </div>
            <div>
              <h2 className="text-white font-medium text-sm sm:text-base">
                {activeChat.user.displayName}
              </h2>
              <p className="text-purple-300 text-xs">
                {activeChat.user.isOnline ? 'Online' : 'Last seen recently'}
              </p>
            </div>
          </div>
          <button className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation">
            ⋯
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 pb-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty
              icon="💬"
              title="No messages yet"
              subtitle="Start the conversation!"
            />
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs sm:max-w-md px-3 py-2 rounded-lg ${
                  message.senderId === user?.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.senderId === user?.id ? 'text-purple-200' : 'text-purple-300'
                }`}>
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white/10 backdrop-blur-sm border-t border-white/20 p-3 sm:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="1"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors touch-manipulation"
            >
              {isSending ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Notifications Component
const Notifications = () => {
  const { showSuccess, showError } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [challengeMeta, setChallengeMeta] = useState({}); // battleId -> { accept_deadline, status, mode }

  // Mock notifications data
  const mockNotifications = [
    {
      id: '1',
      type: 'like',
      icon: '❤️',
      title: 'John Doe liked your battle',
      subtitle: 'Sunset Photography Battle',
      timeAgo: '2m ago',
      isRead: false
    },
    {
      id: '2',
      type: 'vote',
      icon: '🗳️',
      title: 'New vote on your battle',
      subtitle: 'Street Art Challenge',
      timeAgo: '15m ago',
      isRead: false
    },
    {
      id: '3',
      type: 'follow',
      icon: '👥',
      title: 'Photo Pro started following you',
      subtitle: '',
      timeAgo: '1h ago',
      isRead: true
    },
    {
      id: '4',
      type: 'battle_invite',
      icon: '⚔️',
      title: 'Battle invitation from Art Lover',
      subtitle: 'Portrait Photography Battle',
      timeAgo: '2h ago',
      isRead: false
    },
    {
      id: '5',
      type: 'comment',
      icon: '💬',
      title: 'Private comment on your battle',
      subtitle: 'Nature Photography Challenge',
      timeAgo: '3h ago',
      isRead: true
    }
  ];

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiService.getNotifications();
      if (response) {
        const list = response.notifications || [];
        setNotifications(list);
        // Load accept deadlines for challenge invites
        const challengeIds = list
          .filter(n => n.type === 'challenge_sent' && n.reference_id)
          .map(n => n.reference_id);
        if (challengeIds.length) {
          const metas = {};
          await Promise.all(challengeIds.map(async (bid) => {
            try {
              const res = await apiService.getBattle(bid);
              const b = res.battle || res;
              metas[bid] = {
                accept_deadline: b.accept_deadline,
                status: b.status,
                mode: b.mode
              };
            } catch (_e) {}
          }));
          setChallengeMeta(metas);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (showError) {
        showError('Failed to load notifications');
      }
      // Set empty notifications if API fails
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const timeLeft = (iso) => {
    if (!iso) return '';
    const end = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, end - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
  };

  const acceptInvite = async (battleId, notifId) => {
    try {
      await apiService.acceptBattle(battleId);
      showSuccess && showSuccess('Accepted. Upload your image to start.');
      markAsRead(notifId);
    } catch (e) {
      showError && showError('Failed to accept invite');
    }
  };

  const declineInvite = async (battleId, notifId) => {
    try {
      await apiService.declineBattle(battleId);
      showSuccess && showSuccess('Invite declined');
      markAsRead(notifId);
    } catch (e) {
      showError && showError('Failed to decline invite');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      if (showError) {
        showError('Failed to mark notification as read');
      }
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
    if (showSuccess) {
      showSuccess('All notifications marked as read');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="max-w-4xl mx-auto p-4">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/20 rounded w-3/4"></div>
                    <div className="h-3 bg-white/20 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 pb-20">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center p-3 sm:p-4">
          <button 
            onClick={() => window.history.back()}
            className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation"
          >
            ← Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-purple-200 hover:text-white active:text-purple-100 transition-colors touch-manipulation text-sm"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {notifications.length === 0 ? (
          <Empty
            icon="🔔"
            title="No notifications yet"
            subtitle="You'll see notifications for likes, votes, follows, and more here."
          />
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`p-3 sm:p-4 rounded-lg transition-colors touch-manipulation cursor-pointer ${
                  notification.isRead 
                    ? 'bg-white/5 hover:bg-white/10' 
                    : 'bg-purple-500/20 hover:bg-purple-500/30'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="text-2xl flex-shrink-0">{notification.icon || '🔔'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium text-sm sm:text-base">
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                    {notification.subtitle && (
                      <p className="text-purple-200 text-xs sm:text-sm mt-1">
                        {notification.subtitle}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-purple-300 text-xs">
                        {notification.timeAgo || new Date(notification.created_at).toLocaleString()}
                      </p>
                      {notification.type === 'challenge_sent' && notification.reference_id && (
                        <div className="flex items-center gap-2">
                          {challengeMeta[notification.reference_id]?.accept_deadline && (
                            <span className="text-purple-200 text-xs mr-1">
                              {timeLeft(challengeMeta[notification.reference_id].accept_deadline)}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); acceptInvite(notification.reference_id, notification.id); }}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); declineInvite(notification.reference_id, notification.id); }}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Toast Context and Provider
const ToastContext = React.createContext();

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now().toString();
    const newToast = { id, ...toast };
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message) => addToast({ type: 'success', message });
  const showError = (message) => addToast({ type: 'error', message });
  const showInfo = (message) => addToast({ type: 'info', message });

  // Only show toasts on the Notifications route (hide on Home and all other pages)
  const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
  const filteredToasts = pathname.startsWith('/notifications') ? toasts : [];

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showInfo }}>
      {children}
      <ToastContainer toasts={filteredToasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Container Component
const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`p-3 sm:p-4 rounded-lg shadow-lg backdrop-blur-sm max-w-sm transition-all duration-300 ${
            toast.type === 'success' 
              ? 'bg-green-500/90 text-white'
              : toast.type === 'error'
              ? 'bg-red-500/90 text-white'
              : 'bg-blue-500/90 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base">{toast.message}</span>
            <button
              onClick={() => onRemove(toast.id)}
              className="ml-2 text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const resp = await apiService.getNotifications();
        const list = Array.isArray(resp?.notifications) ? resp.notifications : Array.isArray(resp) ? resp : [];
        const isUnread = (n) => (typeof n.isRead === 'boolean' ? !n.isRead : (typeof n.is_read === 'boolean' ? !n.is_read : false));
        const count = list.filter(isUnread).length;
        setUnreadCount(count);
      } catch (_) {
        setUnreadCount(0);
      }
    };
    if (user) {
      loadUnread();
    } else {
      setUnreadCount(0);
    }
  }, [user]);

  return (
    <BrowserRouter>
      <div className="App">
          <Routes>
              <Route path="/" element={<AuthGuard><Home unreadCount={unreadCount} /></AuthGuard>} />
              <Route path="/ranking" element={<AuthGuard><Ranking /></AuthGuard>} />
              <Route path="/create" element={<AuthGuard><CreateBattle /></AuthGuard>} />
              <Route path="/chats" element={<AuthGuard><Chats /></AuthGuard>} />
              <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
              <Route path="/profile/:username" element={<AuthGuard><Profile /></AuthGuard>} />
              <Route path="/search" element={<AuthGuard><Search /></AuthGuard>} />
              <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
          
          {/* Bottom Navigation */}
          <BottomNavigation />
      </div>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

// Auth Guard Component
const AuthGuard = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default App;
