//App.tsx

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import Login from "./pages/Login";
import Index from "./pages/Index";
import AddCandidate from "./pages/AddCandidate";
import CandidateDetails from "./pages/CandidateDetails";
import LegacySearch from "./pages/LegacySearch";
import ViewCandidates from "./pages/ViewCandidates";
import ScheduleInterview from "./pages/ScheduleInterview";
import ReminderSettings from "./pages/ReminderSettings";
import EventTracker from "./pages/EventTracker";
import EventTrackerList from "./pages/EventTrackerList";
import PanelMembers from "./pages/PanelMembers";
import Scheduler from "./pages/Scheduler";
import NotFound from "./pages/NotFound";
import { Button } from "@/components/ui/button";
import ClientDashboard from "./pages/ClientDashboard";
import CampaignManager from "./pages/CampaignManager";
import CandidateSearch from "./pages/CandidateSearch";

const queryClient = new QueryClient();

// Component to handle user_id extraction
const AuthHandler = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const [isAuthProcessed, setIsAuthProcessed] = useState(false);

  useEffect(() => {
    console.log("AuthHandler - Current URL:", window.location.href); // Debug log
    console.log("AuthHandler - Location:", location); // Debug log
    const params = new URLSearchParams(location.search);
    const userId = params.get("user_id");
    console.log("AuthHandler - user_id from URL:", userId); // Debug log
    if (userId) {
      localStorage.setItem("user_id", userId);
      console.log("AuthHandler - Stored user_id in localStorage:", userId); // Debug log
      // Remove user_id from URL
      window.history.replaceState({}, "", location.pathname);
      console.log("AuthHandler - Cleaned URL:", window.location.href); // Debug log
    } else {
      console.log("AuthHandler - No user_id in URL"); // Debug log
    }
    console.log("AuthHandler - Current localStorage user_id:", localStorage.getItem("user_id")); // Debug log
    setIsAuthProcessed(true);
  }, [location]);

  if (!isAuthProcessed) {
    console.log("AuthHandler - Waiting for auth processing..."); // Debug log
    return null; // Delay rendering until auth is processed
  }

  return children;
};

// ProtectedRoute component to check for user_id
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const userId = sessionStorage.getItem("user_id"); // Use sessionStorage
  console.log("ProtectedRoute - user_id:", userId);
  if (!userId) {
    console.log("ProtectedRoute - No user_id, redirecting to /");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Authentication required. Please log in again.</p>
          <Button onClick={() => window.location.href = "/"}>Go to Login</Button>
        </div>
      </div>
    );
  }
  return children;
};

// Synchronous user_id extraction before BrowserRouter
const extractUserId = () => {
  console.log("extractUserId - Initial URL:", window.location.href);
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("user_id");
  if (userId) {
    sessionStorage.setItem("user_id", userId); // Use sessionStorage
    console.log("extractUserId - Stored user_id in sessionStorage:", userId);
    window.history.replaceState({}, "", window.location.pathname);
    console.log("extractUserId - Cleaned URL:", window.location.href);
  }
  console.log("extractUserId - Current sessionStorage user_id:", sessionStorage.getItem("user_id"));
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  </SidebarProvider>
);

const App = () => {
  extractUserId(); // Run synchronously before rendering

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthHandler>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                path="/dashboard"
                element={<Navigate to="/client-dashboard" replace />}
              />
              <Route
                path="/client-dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout><ClientDashboard /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaign-manager/:clientId"
                element={
                  <ProtectedRoute>
                    <AppLayout><CampaignManager /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/candidate-search/:campaignId"
                element={
                  <ProtectedRoute>
                    <AppLayout><CandidateSearch /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <AppLayout><Index /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-candidate"
                element={
                  <ProtectedRoute>
                    <AppLayout><AddCandidate /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/candidate/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout><CandidateDetails /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/legacy-search"
                element={
                  <ProtectedRoute>
                    <AppLayout><LegacySearch /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/view-candidates"
                element={
                  <ProtectedRoute>
                    <AppLayout><ViewCandidates /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/panel-members"
                element={
                  <ProtectedRoute>
                    <AppLayout><PanelMembers /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scheduler"
                element={
                  <ProtectedRoute>
                    <AppLayout><Scheduler /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/event-tracker"
                element={
                  <ProtectedRoute>
                    <AppLayout><EventTrackerList /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hiring-campaign-tracker"
                element={<Navigate to="/client-dashboard" replace />}
              />
              <Route
                path="/reminder-settings"
                element={
                  <ProtectedRoute>
                    <AppLayout><ReminderSettings /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule-interview/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout><ScheduleInterview /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/event-tracker/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout><EventTracker /></AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthHandler>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;