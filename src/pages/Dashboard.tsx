import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useClientAuth } from '@/hooks/useClientAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  Target, 
  Mic, 
  Calendar, 
  CreditCard, 
  LogOut, 
  ExternalLink,
  Clock,
  FileText,
  Loader2
} from 'lucide-react';
import { addMonths, format } from 'date-fns';

interface SessionHistoryItem {
  id: string;
  created_at: string;
  session_type: string;
  first_name: string | null;
  company_url: string | null;
  job_description: string | null;
  status: string;
}

const PRO_LIMITS = {
  full_mock: 6,
  premium_audio: 2,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, isLoading, isProSubscriber, signOut, refreshProfile } = useClientAuth();
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Redirect non-Pro users (only after profile has fully loaded)
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
      return;
    }
    
    // Wait until we have a profile before deciding - the profile determines pro status
    if (!isLoading && user && profile !== undefined && !isProSubscriber) {
      navigate('/');
      return;
    }
  }, [isLoading, user, profile, isProSubscriber, navigate]);

  // Fetch session history
  useEffect(() => {
    async function fetchHistory() {
      if (!profile?.email) return;
      
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('id, created_at, session_type, first_name, company_url, job_description, status')
        .ilike('email', profile.email)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setSessionHistory(data as SessionHistoryItem[]);
      }
      setHistoryLoading(false);
    }

    if (profile?.email) {
      fetchHistory();
    }
  }, [profile?.email]);

  // Refresh + sync profile on mount to get latest subscription data
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.email) return;

      // Sync subscription fields (member since / next billing / resets)
      try {
        await supabase.functions.invoke('pro-session', {
          body: { action: 'check_pro_status', email: user.email },
        });
      } catch (e) {
        console.warn('Pro status sync failed:', e);
      }

      if (!cancelled) {
        refreshProfile();
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const handleManageSubscription = async () => {
    if (!profile?.email) return;
    
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { email: profile.email },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast({
        title: 'Error',
        description: 'Failed to open subscription management. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getSessionTypeDisplay = (type: string) => {
    switch (type) {
      case 'quick_prep':
        return { label: 'Quick Prep', icon: <Zap className="w-4 h-4" /> };
      case 'full_mock':
        return { label: 'Mock Interview', icon: <Target className="w-4 h-4" /> };
      case 'premium_audio':
        return { label: 'Audio Mock', icon: <Mic className="w-4 h-4" /> };
      case 'pro':
        return { label: 'Pro Session', icon: <Target className="w-4 h-4" /> };
      default:
        return { label: type, icon: <FileText className="w-4 h-4" /> };
    }
  };

  const extractCompanyName = (session: SessionHistoryItem) => {
    if (session.company_url) {
      try {
        const url = new URL(session.company_url.startsWith('http') ? session.company_url : `https://${session.company_url}`);
        return url.hostname.replace('www.', '').split('.')[0];
      } catch {
        return session.company_url;
      }
    }
    if (session.job_description) {
      const lines = session.job_description.split('\n');
      return lines[0]?.slice(0, 30) || 'Unknown';
    }
    return 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            <Link to="/" className="flex items-center gap-3">
              <span className="text-2xl font-heading font-bold text-primary">Talendro<span className="text-secondary">™</span></span>
              <span className="hidden sm:inline text-tal-gray font-sans font-medium text-lg">Interview Coach</span>
            </Link>
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="container px-4 md:px-6 py-8 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  if (!user || !isProSubscriber) {
    return null;
  }

  const mockRemaining = PRO_LIMITS.full_mock - (profile?.pro_mock_sessions_used || 0);
  const audioRemaining = PRO_LIMITS.premium_audio - (profile?.pro_audio_sessions_used || 0);
  const mockProgress = ((profile?.pro_mock_sessions_used || 0) / PRO_LIMITS.full_mock) * 100;
  const audioProgress = ((profile?.pro_audio_sessions_used || 0) / PRO_LIMITS.premium_audio) * 100;

  const parseIsoDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatUtcDate = (date: Date, variant: 'short' | 'long' = 'long') => {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      year: 'numeric',
      month: variant === 'long' ? 'long' : 'short',
      day: 'numeric',
    });
    return fmt.format(date);
  };

  const memberSinceDate = parseIsoDate(profile?.pro_subscription_start);

  const nextBillingDate = (() => {
    const now = new Date();
    const end = parseIsoDate(profile?.pro_subscription_end);

    // Prefer backend-provided period end when available.
    // Allow a small window to avoid timezone/clock edge cases.
    if (end && end.getTime() > now.getTime() - 6 * 60 * 60 * 1000) return end;

    // Fallback: derive the next billing date from the original purchase date (billing anchor).
    if (!memberSinceDate) return end;

    let next = memberSinceDate;
    while (next.getTime() <= now.getTime()) {
      next = addMonths(next, 1);
    }
    return next;
  })();

  const subscriptionStatus = profile?.pro_cancel_at_period_end
    ? `Cancels on ${nextBillingDate ? formatUtcDate(nextBillingDate, 'short') : 'period end'}`
    : 'Active';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl font-heading font-bold text-primary">Talendro<span className="text-secondary">™</span></span>
            <span className="hidden sm:inline text-tal-gray font-sans font-medium text-lg">Interview Coach</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 md:px-6 py-8 space-y-6 max-w-5xl mx-auto">
        {/* Subscription Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              YOUR SUBSCRIPTION
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">Interview Coach Pro</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={profile?.pro_cancel_at_period_end ? 'outline' : 'default'} className="mt-1">
                  {subscriptionStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member since</p>
                <p className="font-medium">
                  {memberSinceDate ? formatUtcDate(memberSinceDate, 'long') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next billing</p>
                <p className="font-medium">
                  {nextBillingDate ? `${formatUtcDate(nextBillingDate, 'long')} — $79.00` : 'N/A'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="gap-2"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Subscription
            </Button>
          </CardContent>
        </Card>

        {/* Usage This Month */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-secondary" />
                USAGE THIS MONTH
              </CardTitle>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Resets: {nextBillingDate ? formatUtcDate(nextBillingDate, 'short') : 'N/A'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick Prep - Unlimited */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-secondary" />
                <span className="font-medium">Quick Prep</span>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Unlimited ✓
              </Badge>
            </div>

            {/* Mock Interview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-secondary" />
                  <span className="font-medium">Mock Interview</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {profile?.pro_mock_sessions_used || 0} of {PRO_LIMITS.full_mock} used
                </span>
              </div>
              <Progress value={mockProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{Math.max(0, mockRemaining)} remaining</p>
            </div>

            {/* Audio Mock */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-secondary" />
                  <span className="font-medium">Audio Mock</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {profile?.pro_audio_sessions_used || 0} of {PRO_LIMITS.premium_audio} used
                </span>
              </div>
              <Progress value={audioProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{Math.max(0, audioRemaining)} remaining</p>
            </div>
          </CardContent>
        </Card>

        {/* Start a Session */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">START A SESSION</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Quick Prep */}
              <Card className="border-2 hover:border-secondary/50 transition-colors">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Quick Prep</h3>
                    <p className="text-sm text-muted-foreground">Unlimited</p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate('/interview-coach?session_type=pro&type=quick_prep')}
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>

              {/* Mock Interview */}
              <Card className={`border-2 transition-colors ${mockRemaining > 0 ? 'hover:border-secondary/50' : 'opacity-60'}`}>
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                    <Target className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Mock Interview</h3>
                    <p className="text-sm text-muted-foreground">
                      {mockRemaining > 0 ? `${mockRemaining} remaining` : 'Limit reached'}
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    disabled={mockRemaining <= 0}
                    onClick={() => navigate('/interview-coach?session_type=pro&type=mock')}
                  >
                    {mockRemaining > 0 ? 'Start' : `Resets ${nextBillingDate 
                      ? format(nextBillingDate, 'MMM d')
                      : 'soon'}`}
                  </Button>
                </CardContent>
              </Card>

              {/* Audio Mock */}
              <Card className={`border-2 transition-colors ${audioRemaining > 0 ? 'hover:border-secondary/50' : 'opacity-60'}`}>
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Audio Mock</h3>
                    <p className="text-sm text-muted-foreground">
                      {audioRemaining > 0 ? `${audioRemaining} remaining` : 'Limit reached'}
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    disabled={audioRemaining <= 0}
                    onClick={() => navigate('/interview-coach?session_type=pro&type=audio')}
                  >
                    {audioRemaining > 0 ? 'Start' : `Resets ${nextBillingDate 
                      ? format(nextBillingDate, 'MMM d')
                      : 'soon'}`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Session History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" />
              SESSION HISTORY
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sessionHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No sessions yet. Start your first session above!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Company/Role</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.map((session) => {
                      const typeInfo = getSessionTypeDisplay(session.session_type);
                      return (
                        <tr key={session.id} className="border-b last:border-0">
                          <td className="py-3 px-2 text-sm">
                            {format(new Date(session.created_at), 'MMM d')}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2 text-sm">
                              {typeInfo.icon}
                              {typeInfo.label}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm capitalize">
                            {extractCompanyName(session)}
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant={session.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                              {session.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
