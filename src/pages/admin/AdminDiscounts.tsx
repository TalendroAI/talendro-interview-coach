import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  applicable_products: string[] | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
  created_at: string;
}

const PRODUCTS = [
  { id: 'quick_prep', name: 'Quick Prep ($12)' },
  { id: 'full_mock', name: 'Full Mock ($29)' },
  { id: 'premium_audio', name: 'Premium Audio ($49)' },
  { id: 'pro', name: 'Pro Subscription ($79/mo)' },
];

export default function AdminDiscounts() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_percent: 10,
    applicable_products: ['quick_prep', 'full_mock', 'premium_audio', 'pro'],
    valid_until: '',
    max_uses: '',
    is_active: true,
  });

  const fetchCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes((data as DiscountCode[]) || []);
    } catch (error) {
      console.error('Error fetching codes:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load discount codes',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const openCreateDialog = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      description: '',
      discount_percent: 10,
      applicable_products: ['quick_prep', 'full_mock', 'premium_audio', 'pro'],
      valid_until: '',
      max_uses: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || '',
      discount_percent: code.discount_percent,
      applicable_products: code.applicable_products || PRODUCTS.map(p => p.id),
      valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
      max_uses: code.max_uses?.toString() || '',
      is_active: code.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || formData.discount_percent <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid form',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_percent: formData.discount_percent,
        applicable_products: formData.applicable_products,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        is_active: formData.is_active,
      };

      if (editingCode) {
        const { error } = await supabase
          .from('discount_codes')
          .update(payload)
          .eq('id', editingCode.id);
        if (error) throw error;
        toast({ title: 'Discount code updated' });
      } else {
        const { error } = await supabase
          .from('discount_codes')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Discount code created' });
      }

      setIsDialogOpen(false);
      fetchCodes();
    } catch (error: unknown) {
      console.error('Error saving code:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this code?')) return;

    try {
      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Discount code deleted' });
      fetchCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete',
      });
    }
  };

  const toggleProductSelection = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      applicable_products: prev.applicable_products.includes(productId)
        ? prev.applicable_products.filter(p => p !== productId)
        : [...prev.applicable_products, productId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold">Discount Codes</h2>
          <p className="text-muted-foreground">Create and manage promotional codes</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : codes.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No discount codes yet</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                Create your first code
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Max Uses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>{code.discount_percent}%</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {code.applicable_products?.length === 4 ? (
                            <Badge variant="outline">All products</Badge>
                          ) : (
                            code.applicable_products?.map(p => (
                              <Badge key={p} variant="secondary" className="text-xs">
                                {p.replace('_', ' ')}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {code.valid_until 
                          ? format(new Date(code.valid_until), 'MMM d, yyyy')
                          : 'No expiry'}
                      </TableCell>
                      <TableCell>{code.max_uses || '∞'}</TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? 'default' : 'secondary'}>
                          {code.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(code)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(code.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit Discount Code' : 'Create Discount Code'}
            </DialogTitle>
            <DialogDescription>
              {editingCode ? 'Update the discount code details' : 'Create a new promotional code'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., SAVE20"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount % *</Label>
                <Input
                  id="discount"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_percent: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Holiday sale discount"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Applicable Products</Label>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCTS.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted"
                  >
                    <Checkbox
                      checked={formData.applicable_products.includes(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                    />
                    <span className="text-sm">{product.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_uses">Max Uses</Label>
                <Input
                  id="max_uses"
                  type="number"
                  placeholder="Unlimited"
                  value={formData.max_uses}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingCode ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
