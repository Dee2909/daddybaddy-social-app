import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { isAuthenticated, isLoading } = useAuth();

  const getAuthTab = () => {
    if (isLoading) {
      return { id: 'auth', icon: 'fas fa-spinner fa-spin', label: 'Loading' };
    }
    
    if (!isAuthenticated) {
      return { id: 'login', icon: 'fas fa-sign-in-alt', label: 'Login' };
    }
    
    return { id: 'profile', icon: 'fas fa-user', label: 'Profile' };
  };

  const tabs = [
    { id: 'home', icon: 'fas fa-home', label: 'Home' },
    { id: 'ranking', icon: 'fas fa-trophy', label: 'Ranking' },
    { id: 'create', icon: 'fas fa-sword', label: 'Create' },
    { id: 'chats', icon: 'fas fa-comment', label: 'Chats' },
    getAuthTab(),
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-card border-t border-border z-50">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'login') {
                window.location.href = '/api/login';
              } else {
                onTabChange(tab.id);
              }
            }}
            className={cn(
              "flex flex-col items-center py-2 px-4",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground"
            )}
            data-testid={`tab-${tab.id}`}
          >
            <i className={`${tab.icon} text-xl mb-1`} />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
