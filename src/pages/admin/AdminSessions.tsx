import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, Clock, CheckCircle, XCircle, Hourglass, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface Session {
  id: string;
  email: string;
  session_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_prep: 'Quick Prep',
  full_mock: 'Full Mock',
  premium_audio: 'Premium Audio',
  pro: 'Pro',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline'; description?: string }> = {
  pending: { label: 'Pending', icon: Hourglass, variant: 'secondary', description: 'Checkout started but payment not completed' },
  active: { label: 'Active', icon: Clock, variant: 'default', description: 'Session in progress' },
  completed: { label: 'Completed', icon: CheckCircle, variant: 'outline', description: 'Session finished' },
  cancelled: { label: 'Cancelled', icon: XCircle, variant: 'destructive', description: 'Session was cancelled' },
};

export default function AdminSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all' | 'completed' | 'pending'>('selected');
  const [isDeleting, setIsDeleting] = useState(false);
  const pendingCount = sessions.filter(s => s.status === 'pending').length;

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('coaching_sessions')
        .select('id, email, session_type, status, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'active' | 'completed' | 'cancelled');
      }
      if (typeFilter !== 'all') {
        query = query.eq('session_type', typeFilter as 'quick_prep' | 'full_mock' | 'premium_audio' | 'pro');
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions((data as Session[]) || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load sessions',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, typeFilter]);

  const filteredSessions = sessions.filter((session) => {
    if (!search) return true;
    return session.email.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="cursor-help">
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSingle = async (id: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('coaching_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Session deleted' });
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete session',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      let query = supabase.from('coaching_sessions').delete();

      if (deleteType === 'selected') {
        query = query.in('id', Array.from(selectedIds));
      } else if (deleteType === 'completed') {
        query = query.eq('status', 'completed');
      } else if (deleteType === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        // Delete all - match on non-null id
        query = query.not('id', 'is', null);
      }

      const { error } = await query;

      if (error) throw error;

      const messages = {
        selected: `${selectedIds.size} session(s) deleted`,
        completed: 'All completed sessions deleted',
        pending: 'All pending (abandoned) sessions deleted',
        all: 'All sessions deleted',
      };

      toast({ title: messages[deleteType] });
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchSessions();
    } catch (error) {
      console.error('Error deleting sessions:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete sessions',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold">Sessions</h2>
          <p className="text-muted-foreground">View and manage all coaching sessions</p>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {pendingCount} pending session{pendingCount !== 1 ? 's' : ''} found
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-1">
              Pending sessions are abandoned checkouts where users started payment but never completed. 
              These can be safely deleted using the Delete dropdown → "Delete All Pending".
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quick_prep">Quick Prep</SelectItem>
                <SelectItem value="full_mock">Full Mock</SelectItem>
                <SelectItem value="premium_audio">Premium Audio</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchSessions} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => { setDeleteType('selected'); setDeleteDialogOpen(true); }}
                  disabled={selectedIds.size === 0}
                  className="text-amber-600"
                >
                  Delete Selected ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setDeleteType('completed'); setDeleteDialogOpen(true); }}
                  className="text-amber-600"
                >
                  Delete All Completed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setDeleteType('pending'); setDeleteDialogOpen(true); }}
                  disabled={pendingCount === 0}
                  className="text-amber-600"
                >
                  Delete All Pending ({pendingCount})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { setDeleteType('all'); setDeleteDialogOpen(true); }}
                  className="text-destructive"
                >
                  Delete All Sessions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sessions found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.id} className={selectedIds.has(session.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(session.id)}
                          onCheckedChange={() => toggleSelect(session.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{session.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {session.completed_at
                          ? format(new Date(session.completed_at), 'MMM d, yyyy h:mm a')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSingle(session.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>
              {deleteType === 'selected' && `Delete ${selectedIds.size} Session(s)?`}
              {deleteType === 'completed' && 'Delete All Completed Sessions?'}
              {deleteType === 'pending' && `Delete All ${pendingCount} Pending Sessions?`}
              {deleteType === 'all' && 'Delete All Sessions?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'pending' 
                ? 'Pending sessions are abandoned checkouts where payment was never completed. This action cannot be undone.'
                : 'This action cannot be undone. This will permanently delete the selected session records.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
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