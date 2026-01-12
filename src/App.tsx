import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import InterviewCoach from "./pages/InterviewCoach";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminConversions from "./pages/admin/AdminConversions";
import AdminErrors from "./pages/admin/AdminErrors";
import AdminDiscounts from "./pages/admin/AdminDiscounts";
import AdminSessions from "./pages/admin/AdminSessions";

const queryClient = new QueryClient();

// Component to handle Supabase auth callback (magic link tokens)
function AuthCallbackHandler({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  useEffect(() => {
    // Check if URL contains auth callback parameters (access_token in hash or query params)
    const hashParams = new URLSearchParams(location.hash.slice(1));
    const queryParams = new URLSearchParams(location.search);

    const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
    const type = hashParams.get('type') || queryParams.get('type');

    // Check for redirect_to parameter in hash or query
    const redirectTo = hashParams.get('redirect_to') || queryParams.get('redirect_to');

    if (accessToken && refreshToken && type === 'magiclink') {
      setIsProcessingAuth(true);

      // Set the session with the tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ error }) => {
        if (error) {
          console.error('Error setting session:', error);
          setIsProcessingAuth(false);
          return;
        }

        // Determine redirect destination - honor redirect_to param or default to /dashboard
        let destination = '/dashboard';
        if (redirectTo) {
          try {
            const url = new URL(redirectTo);
            destination = url.pathname; // Extract just the path
          } catch {
            // If not a valid URL, try using it as a path directly
            if (redirectTo.startsWith('/')) {
              destination = redirectTo;
            }
          }
        }

        // Clear the hash/query params and redirect
        window.history.replaceState(null, '', destination);
        navigate(destination, { replace: true });
        setIsProcessingAuth(false);
      });
    }
  }, [location, navigate]);

  if (isProcessingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthCallbackHandler>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/interview-coach" element={<InterviewCoach />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/purchase-success" element={<PurchaseSuccess />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="conversions" element={<AdminConversions />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="errors" element={<AdminErrors />} />
              <Route path="discounts" element={<AdminDiscounts />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthCallbackHandler>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
