import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <i className="fas fa-crown text-white text-2xl" />
          </div>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-32 mx-auto mb-2" />
            <div className="h-3 bg-muted rounded w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
          <i className="fas fa-crown text-white text-3xl" />
        </div>
        
        {/* Title */}
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          DaddyBaddy
        </h1>
        
        {/* Subtitle */}
        <p className="text-xl text-muted-foreground mb-8">
          The ultimate photo battle platform
        </p>
        
        {/* Features */}
        <div className="space-y-4 mb-12">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <i className="fas fa-camera text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Photo Battles</h3>
              <p className="text-sm text-muted-foreground">Challenge friends to epic photo face-offs</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
              <i className="fas fa-vote-yea text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Community Voting</h3>
              <p className="text-sm text-muted-foreground">Let the community decide the winner</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <i className="fas fa-trophy text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Rankings</h3>
              <p className="text-sm text-muted-foreground">Climb the leaderboards and prove your skills</p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => setLocation("/register")}
            className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            data-testid="register-button"
          >
            Get Started
          </button>
          
          <button
            onClick={() => setLocation("/login")}
            className="w-full border border-primary text-primary font-semibold py-4 px-6 rounded-lg hover:bg-primary/5 transition-all duration-200"
            data-testid="login-button"
          >
            Sign In
          </button>
        </div>
        
        {/* Footer */}
        <p className="text-xs text-muted-foreground mt-8">
          Join thousands of photographers in the ultimate battle platform
        </p>
      </div>
    </div>
  );
}
