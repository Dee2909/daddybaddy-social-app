import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import Home from "@/pages/Home";
import Ranking from "@/pages/Ranking";
import Create from "@/pages/Create";
import Chats from "@/pages/Chats";
import Profile from "@/pages/Profile";
import BattleDetail from "@/pages/BattleDetail";
import NotFound from "@/pages/not-found";

// Components
import BottomNav from "@/components/BottomNav";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  // Show authentication pages if not authenticated or still loading
  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Handle battle detail navigation
  if (selectedBattleId) {
    return (
      <BattleDetail
        battleId={selectedBattleId}
        onBack={() => setSelectedBattleId(null)}
      />
    );
  }

  // Show floating action button for home and ranking tabs
  const showFAB = activeTab === "home" || activeTab === "ranking";

  return (
    <div className="relative">
      {/* Main Content */}
      <div className="pb-16">
        {activeTab === "home" && <Home />}
        {activeTab === "ranking" && <Ranking />}
        {activeTab === "create" && <Create />}
        {activeTab === "chats" && <Chats />}
        {activeTab === "profile" && <Profile />}
      </div>

      {/* Floating Action Button */}
      {showFAB && (
        <button
          onClick={() => setActiveTab("create")}
          className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-primary to-accent text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 z-40"
          data-testid="fab-create-battle"
        >
          <i className="fas fa-plus text-xl" />
        </button>
      )}

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
