import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface LoginFormData {
  identifier: string;
  password: string;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store token in localStorage
        localStorage.setItem("authToken", data.token);
        
        // Invalidate auth query to refetch user data
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
        
        toast({
          title: "Login successful!",
          description: "Welcome back to DaddyBaddy!",
        });
        
        // Force page reload to ensure auth state is properly updated
        window.location.href = "/";
      } else {
        const errorData = await response.json();
        
        // Handle email verification required
        if (response.status === 403 && errorData.email) {
          setError("Please verify your email before logging in.");
          toast({
            title: "Email verification required",
            description: "Please check your email and verify your account first.",
            variant: "destructive",
          });
          // Redirect to verification page
          setTimeout(() => {
            setLocation(`/verify-email?email=${encodeURIComponent(errorData.email)}`);
          }, 2000);
        } else {
          setError(errorData.message || "Login failed");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your DaddyBaddy account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="identifier">Email, Username, or Phone</Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                value={formData.identifier}
                onChange={handleInputChange}
                placeholder="Enter your email, username, or phone number"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                onClick={() => setLocation("/register")}
                className="text-purple-600 hover:text-purple-500 font-medium"
              >
                Sign up
              </button>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setLocation("/forgot-password")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Forgot your password?
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
