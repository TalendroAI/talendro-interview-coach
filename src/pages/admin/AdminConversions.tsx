import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, RefreshCw, Trash2, TrendingUp, Users, DollarSign, CreditCard, Crown } from 'lucide-react';

interface ProSubscriber {
  id: string;
  email: string;
  full_name: string | null;
  is_pro_subscriber: boolean;
  pro_subscription_start: string | null;
  pro_subscription_end: string | null;
  pro_cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}

interface OneOffPurchase {
  id: string;
  email: string;
  session_type: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface ConversionStats {
  totalProSubscribers: number;
  activeProSubscribers: number;
  cancellingSubscribers: number;
  totalOneOffPurchases: number;
  quickPrepPurchases: number;
  fullMockPurchases: number;
  premiumAudioPurchases: number;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_prep: 'Quick Prep ($12)',
  full_mock: 'Full Mock ($29)',
  premium_audio: 'Premium Audio ($49)',
};

const SESSION_PRICES: Record<string, number> = {
  quick_prep: 12,
  full_mock: 29,
  premium_audio: 49,
};

export default function AdminConversions() {
  const [subscribers, setSubscribers] = useState<ProSubscriber[]>([]);
  const [purchases, setPurchases] = useState<OneOffPurchase[]>([]);
  const [stats, setStats] = useState<ConversionStats>({
    totalProSubscribers: 0,
    activeProSubscribers: 0,
    cancellingSubscribers: 0,
    totalOneOffPurchases: 0,
    quickPrepPurchases: 0,
    fullMockPurchases: 0,
    premiumAudioPurchases: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<Set<string>>(new Set());
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'subscribers' | 'purchases'>('subscribers');
  const [deleteType, setDeleteType] = useState<'selected' | 'all'>('selected');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Pro subscribers
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const allProfiles = (profilesData || []) as ProSubscriber[];
      const proSubs = allProfiles.filter(p => p.is_pro_subscriber || p.stripe_subscription_id);
      setSubscribers(proSubs);

      // Fetch one-off purchases (sessions with stripe info that aren't Pro)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('coaching_sessions')
        .select('id, email, session_type, stripe_checkout_session_id, stripe_payment_intent_id, status, created_at, completed_at')
        .in('session_type', ['quick_prep', 'full_mock', 'premium_audio'])
        .not('stripe_checkout_session_id', 'is', null)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      setPurchases((sessionsData || []) as OneOffPurchase[]);

      // Calculate stats
      const activeProSubs = proSubs.filter(p => p.is_pro_subscriber && !p.pro_cancel_at_period_end);
      const cancellingSubs = proSubs.filter(p => p.is_pro_subscriber && p.pro_cancel_at_period_end);
      const quickPrep = sessionsData?.filter(s => s.session_type === 'quick_prep') || [];
      const fullMock = sessionsData?.filter(s => s.session_type === 'full_mock') || [];
      const premiumAudio = sessionsData?.filter(s => s.session_type === 'premium_audio') || [];

      setStats({
        totalProSubscribers: proSubs.length,
        activeProSubscribers: activeProSubs.length,
        cancellingSubscribers: cancellingSubs.length,
        totalOneOffPurchases: sessionsData?.length || 0,
        quickPrepPurchases: quickPrep.length,
        fullMockPurchases: fullMock.length,
        premiumAudioPurchases: premiumAudio.length,
      });

      setSelectedSubscriberIds(new Set());
      setSelectedPurchaseIds(new Set());
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load conversion data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSubscribers = subscribers.filter(s => 
    !search || s.email.toLowerCase().includes(search.toLowerCase()) || 
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPurchases = purchases.filter(p =>
    !search || p.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSubscriberSelectAll = () => {
    if (selectedSubscriberIds.size === filteredSubscribers.length) {
      setSelectedSubscriberIds(new Set());
    } else {
      setSelectedSubscriberIds(new Set(filteredSubscribers.map(s => s.id)));
    }
  };

  const toggleSubscriberSelect = (id: string) => {
    const newSelected = new Set(selectedSubscriberIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSubscriberIds(newSelected);
  };

  const togglePurchaseSelectAll = () => {
    if (selectedPurchaseIds.size === filteredPurchases.length) {
      setSelectedPurchaseIds(new Set());
    } else {
      setSelectedPurchaseIds(new Set(filteredPurchases.map(p => p.id)));
    }
  };

  const togglePurchaseSelect = (id: string) => {
    const newSelected = new Set(selectedPurchaseIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPurchaseIds(newSelected);
  };

  const handleDeleteSubscribers = async () => {
    setIsDeleting(true);
    try {
      let query = supabase.from('profiles').delete();

      if (deleteType === 'selected') {
        query = query.in('id', Array.from(selectedSubscriberIds));
      } else {
        query = query.eq('is_pro_subscriber', true);
      }

      const { error } = await query;
      if (error) throw error;

      toast({ title: deleteType === 'selected' ? `${selectedSubscriberIds.size} subscriber(s) deleted` : 'All Pro subscribers deleted' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting subscribers:', error);
      toast({ variant: 'destructive', title: 'Failed to delete' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePurchases = async () => {
    setIsDeleting(true);
    try {
      let query = supabase.from('coaching_sessions').delete();

      if (deleteType === 'selected') {
        query = query.in('id', Array.from(selectedPurchaseIds));
      } else {
        query = query.in('session_type', ['quick_prep', 'full_mock', 'premium_audio']).not('stripe_checkout_session_id', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;

      toast({ title: deleteType === 'selected' ? `${selectedPurchaseIds.size} purchase(s) deleted` : 'All one-off purchases deleted' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting purchases:', error);
      toast({ variant: 'destructive', title: 'Failed to delete' });
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateRevenue = () => {
    const oneOffRevenue = purchases.reduce((acc, p) => acc + (SESSION_PRICES[p.session_type] || 0), 0);
    const proRevenue = stats.totalProSubscribers * 79; // $79/mo
    return { oneOffRevenue, proRevenue, totalRevenue: oneOffRevenue + proRevenue };
  };

  const revenue = calculateRevenue();

  const statCards = [
    { title: 'Pro Subscribers', value: stats.activeProSubscribers, description: `${stats.cancellingSubscribers} cancelling`, icon: Crown, color: 'text-amber-500' },
    { title: 'One-Off Purchases', value: stats.totalOneOffPurchases, description: 'Quick Prep, Mock, Audio', icon: CreditCard, color: 'text-blue-500' },
    { title: 'Est. Pro Revenue', value: `$${revenue.proRevenue}`, description: 'Monthly recurring', icon: DollarSign, color: 'text-green-500' },
    { title: 'One-Off Revenue', value: `$${revenue.oneOffRevenue}`, description: 'All-time purchases', icon: TrendingUp, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Conversions</h2>
        <p className="text-muted-foreground">Track subscriptions and purchases</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Search and Refresh */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscribers">
        <TabsList>
          <TabsTrigger value="subscribers">Pro Subscribers ({subscribers.length})</TabsTrigger>
          <TabsTrigger value="purchases">One-Off Purchases ({purchases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pro Subscribers</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setDeleteTarget('subscribers'); setDeleteType('selected'); setDeleteDialogOpen(true); }}
                    disabled={selectedSubscriberIds.size === 0}
                    className="text-amber-600"
                  >
                    Delete Selected ({selectedSubscriberIds.size})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setDeleteTarget('subscribers'); setDeleteType('all'); setDeleteDialogOpen(true); }}
                    className="text-destructive"
                  >
                    Delete All Pro Subscribers
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No Pro subscribers yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedSubscriberIds.size === filteredSubscribers.length && filteredSubscribers.length > 0}
                            onCheckedChange={toggleSubscriberSelectAll}
                          />
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Renews/Ends</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscribers.map((sub) => (
                        <TableRow key={sub.id} className={selectedSubscriberIds.has(sub.id) ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSubscriberIds.has(sub.id)}
                              onCheckedChange={() => toggleSubscriberSelect(sub.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{sub.email}</TableCell>
                          <TableCell>{sub.full_name || '-'}</TableCell>
                          <TableCell>
                            {sub.is_pro_subscriber ? (
                              sub.pro_cancel_at_period_end ? (
                                <Badge variant="secondary">Cancelling</Badge>
                              ) : (
                                <Badge variant="default">Active</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {sub.pro_subscription_start 
                              ? format(new Date(sub.pro_subscription_start), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {sub.pro_subscription_end
                              ? format(new Date(sub.pro_subscription_end), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                await supabase.from('profiles').delete().eq('id', sub.id);
                                toast({ title: 'Subscriber deleted' });
                                fetchData();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>One-Off Purchases</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setDeleteTarget('purchases'); setDeleteType('selected'); setDeleteDialogOpen(true); }}
                    disabled={selectedPurchaseIds.size === 0}
                    className="text-amber-600"
                  >
                    Delete Selected ({selectedPurchaseIds.size})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setDeleteTarget('purchases'); setDeleteType('all'); setDeleteDialogOpen(true); }}
                    className="text-destructive"
                  >
                    Delete All Purchases
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredPurchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No one-off purchases yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedPurchaseIds.size === filteredPurchases.length && filteredPurchases.length > 0}
                            onCheckedChange={togglePurchaseSelectAll}
                          />
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((purchase) => (
                        <TableRow key={purchase.id} className={selectedPurchaseIds.has(purchase.id) ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPurchaseIds.has(purchase.id)}
                              onCheckedChange={() => togglePurchaseSelect(purchase.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{purchase.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {SESSION_TYPE_LABELS[purchase.session_type] || purchase.session_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            ${SESSION_PRICES[purchase.session_type] || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant={purchase.status === 'completed' ? 'outline' : 'default'}>
                              {purchase.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(purchase.created_at), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                await supabase.from('coaching_sessions').delete().eq('id', purchase.id);
                                toast({ title: 'Purchase deleted' });
                                fetchData();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget === 'subscribers' 
                ? (deleteType === 'selected' ? `Delete ${selectedSubscriberIds.size} Subscriber(s)?` : 'Delete All Pro Subscribers?')
                : (deleteType === 'selected' ? `Delete ${selectedPurchaseIds.size} Purchase(s)?` : 'Delete All Purchases?')
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTarget === 'subscribers' ? handleDeleteSubscribers : handleDeletePurchases}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}