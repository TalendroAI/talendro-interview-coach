import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, CheckCircle, AlertTriangle, Clock, Eye, Trash2, MoreVertical, RefreshCw } from 'lucide-react';

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_code: string | null;
  error_message: string;
  user_email: string | null;
  context: Record<string, unknown> | null;
  ai_resolution_attempted: boolean;
  ai_resolution_successful: boolean | null;
  ai_resolution_response: string | null;
  escalated_to_admin: boolean;
  resolved: boolean;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export default function AdminErrors() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'escalated'>('all');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearType, setClearType] = useState<'all' | 'resolved'>('resolved');

  const fetchErrors = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'unresolved') {
        query = query.eq('resolved', false);
      } else if (filter === 'escalated') {
        query = query.eq('escalated_to_admin', true).eq('resolved', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setErrors((data as ErrorLog[]) || []);
    } catch (error) {
      console.error('Error fetching errors:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load errors',
        description: 'Please try refreshing the page.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [filter]);

  const handleResolve = async () => {
    if (!selectedError) return;
    setIsResolving(true);

    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
        })
        .eq('id', selectedError.id);

      if (error) throw error;

      toast({
        title: 'Error resolved',
        description: 'The error has been marked as resolved.',
      });

      setSelectedError(null);
      setResolutionNotes('');
      fetchErrors();
    } catch (error) {
      console.error('Error resolving:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to resolve error',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleDeleteError = async (errorId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .eq('id', errorId);

      if (error) throw error;

      toast({
        title: 'Error deleted',
        description: 'The error log has been removed.',
      });

      setSelectedError(null);
      fetchErrors();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearErrors = async (type: 'all' | 'resolved') => {
    setIsDeleting(true);
    try {
      let query = supabase.from('error_logs').delete();
      
      if (type === 'resolved') {
        query = query.eq('resolved', true);
      } else {
        // Delete all - need to match some condition, use created_at not null
        query = query.not('created_at', 'is', null);
      }

      const { error } = await query;

      if (error) throw error;

      toast({
        title: type === 'all' ? 'All errors cleared' : 'Resolved errors cleared',
        description: type === 'all' 
          ? 'All error logs have been removed.' 
          : 'All resolved error logs have been removed.',
      });

      setClearDialogOpen(false);
      fetchErrors();
    } catch (error) {
      console.error('Error clearing:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to clear errors',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredErrors = errors.filter((error) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      error.error_message.toLowerCase().includes(searchLower) ||
      error.error_type.toLowerCase().includes(searchLower) ||
      error.user_email?.toLowerCase().includes(searchLower) ||
      error.error_code?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (error: ErrorLog) => {
    if (error.resolved) {
      return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
    }
    if (error.escalated_to_admin) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Needs Attention</Badge>;
    }
    if (error.ai_resolution_successful) {
      return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />AI Resolved</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Error Logs</h2>
        <p className="text-muted-foreground">Monitor and resolve system errors</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search errors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Errors</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="escalated">Needs Attention</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchErrors} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => { setClearType('resolved'); setClearDialogOpen(true); }}
                  className="text-amber-600"
                >
                  Clear Resolved Errors
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => { setClearType('all'); setClearDialogOpen(true); }}
                  className="text-destructive"
                >
                  Clear All Errors
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredErrors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === 'escalated' ? 'No errors needing attention!' : 'No errors found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredErrors.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(error.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{error.error_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {error.error_message}
                      </TableCell>
                      <TableCell className="text-sm">
                        {error.user_email || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(error)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedError(error)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Error Log</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this error log. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteError(error.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Detail Dialog */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Error Details
              {selectedError && getStatusBadge(selectedError)}
            </DialogTitle>
            <DialogDescription>
              {selectedError?.created_at && format(new Date(selectedError.created_at), 'PPpp')}
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="font-medium">{selectedError.error_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Code</label>
                  <p className="font-medium">{selectedError.error_code || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">User Email</label>
                  <p className="font-medium">{selectedError.user_email || 'Unknown'}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Error Message</label>
                <p className="p-3 bg-muted rounded-lg mt-1">{selectedError.error_message}</p>
              </div>

              {selectedError.context && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Context</label>
                  <pre className="p-3 bg-muted rounded-lg mt-1 text-sm overflow-x-auto">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              )}

              {selectedError.ai_resolution_response && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">AI Resolution Sent</label>
                  <p className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg mt-1 text-green-700 dark:text-green-400">
                    {selectedError.ai_resolution_response}
                  </p>
                </div>
              )}

              {selectedError.resolution_notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resolution Notes</label>
                  <p className="p-3 bg-muted rounded-lg mt-1">{selectedError.resolution_notes}</p>
                </div>
              )}

              {!selectedError.resolved && (
                <div className="border-t pt-4 space-y-3">
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <Textarea
                    placeholder="Add notes about how this was resolved..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleResolve} disabled={isResolving}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Error Log</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this error log. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteError(selectedError.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="outline" onClick={() => setSelectedError(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {selectedError.resolved && (
                <div className="border-t pt-4 flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Error
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Error Log</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this error log. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteError(selectedError.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" onClick={() => setSelectedError(null)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Errors Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearType === 'all' ? 'Clear All Error Logs' : 'Clear Resolved Errors'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearType === 'all' 
                ? 'This will permanently delete ALL error logs. This action cannot be undone.'
                : 'This will permanently delete all resolved error logs. Unresolved errors will be kept.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleClearErrors(clearType)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Clearing...' : clearType === 'all' ? 'Clear All' : 'Clear Resolved'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
