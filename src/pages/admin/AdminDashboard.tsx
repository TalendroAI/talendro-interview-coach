import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Users, Tag, TrendingUp, Clock } from 'lucide-react';

interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalErrors: number;
  unresolvedErrors: number;
  activeDiscountCodes: number;
  recentRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    totalErrors: 0,
    unresolvedErrors: 0,
    activeDiscountCodes: 0,
    recentRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch session counts
        const { count: totalSessions } = await supabase
          .from('coaching_sessions')
          .select('*', { count: 'exact', head: true });

        const { count: activeSessions } = await supabase
          .from('coaching_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: completedSessions } = await supabase
          .from('coaching_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');

        // Fetch error counts
        const { count: totalErrors } = await supabase
          .from('error_logs')
          .select('*', { count: 'exact', head: true });

        const { count: unresolvedErrors } = await supabase
          .from('error_logs')
          .select('*', { count: 'exact', head: true })
          .eq('resolved', false);

        // Fetch active discount codes
        const { count: activeDiscountCodes } = await supabase
          .from('discount_codes')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        setStats({
          totalSessions: totalSessions || 0,
          activeSessions: activeSessions || 0,
          completedSessions: completedSessions || 0,
          totalErrors: totalErrors || 0,
          unresolvedErrors: unresolvedErrors || 0,
          activeDiscountCodes: activeDiscountCodes || 0,
          recentRevenue: 0, // Would need Stripe integration to get this
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Sessions',
      value: stats.totalSessions,
      description: 'All-time coaching sessions',
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Active Sessions',
      value: stats.activeSessions,
      description: 'Currently in progress',
      icon: Clock,
      color: 'text-green-500',
    },
    {
      title: 'Completed',
      value: stats.completedSessions,
      description: 'Successfully completed',
      icon: CheckCircle,
      color: 'text-emerald-500',
    },
    {
      title: 'Unresolved Errors',
      value: stats.unresolvedErrors,
      description: `Out of ${stats.totalErrors} total`,
      icon: AlertTriangle,
      color: stats.unresolvedErrors > 0 ? 'text-red-500' : 'text-green-500',
    },
    {
      title: 'Active Discounts',
      value: stats.activeDiscountCodes,
      description: 'Discount codes available',
      icon: Tag,
      color: 'text-purple-500',
    },
    {
      title: 'Conversion Rate',
      value: stats.totalSessions > 0 
        ? `${Math.round((stats.completedSessions / stats.totalSessions) * 100)}%`
        : '0%',
      description: 'Sessions to completion',
      icon: TrendingUp,
      color: 'text-orange-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/4 mb-2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your Interview Coach Pro platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
