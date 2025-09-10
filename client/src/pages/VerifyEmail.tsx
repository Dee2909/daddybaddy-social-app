import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Parse search params manually since wouter returns a string
  const searchParams = new URLSearchParams(search);
  const email = searchParams.get("email") || "";
  
  console.log('VerifyEmail: search string =', search);
  console.log('VerifyEmail: email =', email);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Please enter the verification code");
      return;
    }

    if (!email) {
      setError("Email not found. Please try registering again.");
      return;
    }

    setIsLoading(true);
    setError("");

    console.log('Verifying OTP for email:', email, 'code:', otp);

    try {
      const response = await apiRequest("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: otp,
          type: "email_verification"
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store token in localStorage
        localStorage.setItem("authToken", data.token);
        
        setSuccess(true);
        toast({
          title: "Email verified!",
          description: "Your account has been successfully verified.",
        });
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          type: "email_verification"
        }),
      });

      if (response.ok) {
        toast({
          title: "Code sent!",
          description: "A new verification code has been sent to your email.",
        });
        setResendCooldown(60); // 60 second cooldown
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Failed to resend code");
      }
    } catch (error) {
      console.error("Resend error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-4">
                Your account has been successfully verified. Redirecting to the app...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                name="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                disabled={isLoading}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !otp.trim()}
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Didn't receive the code?
            </p>
            <Button
              variant="outline"
              onClick={handleResendCode}
              disabled={isLoading || resendCooldown > 0}
              className="w-full"
            >
              {resendCooldown > 0 
                ? `Resend in ${resendCooldown}s` 
                : "Resend Code"
              }
            </Button>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setLocation("/login")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
