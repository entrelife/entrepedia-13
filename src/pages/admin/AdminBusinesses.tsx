import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MoreHorizontal, Star, StarOff, Ban, CheckCircle, Eye, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Constants } from '@/integrations/supabase/types';

interface Business {
  id: string;
  name: string;
  category: string;
  location: string | null;
  is_featured: boolean | null;
  is_disabled: boolean | null;
  approval_status: string | null;
  created_at: string | null;
  owner_id: string | null;
  owner?: {
    full_name: string | null;
    username: string | null;
  };
}

export default function AdminBusinesses() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [actionDialog, setActionDialog] = useState<'disable' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Get admin session token
  const getSessionToken = () => {
    const stored = localStorage.getItem('admin_session');
    return stored ? JSON.parse(stored).session_token : null;
  };

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['admin-businesses'],
    queryFn: async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('No admin session');

      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { action: 'get_businesses' },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.businesses as Business[];
    },
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ businessId, feature }: { businessId: string; feature: boolean }) => {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { 
          action: 'update_business',
          business_id: businessId,
          updates: { is_featured: feature }
        },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, { feature }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast.success(feature ? 'Business featured successfully' : 'Business unfeatured');
    },
    onError: (error) => {
      toast.error('Failed to update business: ' + error.message);
    },
  });

  const disableMutation = useMutation({
    mutationFn: async ({ businessId, disable }: { businessId: string; disable: boolean }) => {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { 
          action: 'update_business',
          business_id: businessId,
          updates: { 
            is_disabled: disable,
            disabled_reason: disable ? actionReason : null,
          }
        },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, { disable }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast.success(disable ? 'Business disabled successfully' : 'Business enabled');
      setActionDialog(null);
      setSelectedBusiness(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update business: ' + error.message);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ businessId, status }: { businessId: string; status: 'approved' | 'rejected' }) => {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { 
          action: 'update_business',
          business_id: businessId,
          updates: { 
            approval_status: status,
            disabled_reason: status === 'rejected' ? actionReason : null,
          }
        },
        headers: { 'x-session-token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast.success(`Business ${status} successfully`);
      setActionDialog(null);
      setSelectedBusiness(null);
      setActionReason('');
    },
    onError: (error) => {
      toast.error('Failed to update business: ' + error.message);
    },
  });

  const getStatusBadge = (business: Business) => {
    if (business.is_disabled) {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    if (business.approval_status === 'pending') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">Pending</Badge>;
    }
    if (business.approval_status === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const columns: Column<Business>[] = [
    {
      key: 'name',
      header: 'Business',
      render: (business) => (
        <div>
          <p className="font-medium">{business.name}</p>
          <p className="text-sm text-muted-foreground">
            by {business.owner?.full_name || 'Unknown'}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (business) => (
        <Badge variant="secondary" className="capitalize">
          {business.category}
        </Badge>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (business) => (
        <span className="text-muted-foreground">{business.location || 'Not specified'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (business) => (
        <div className="flex flex-wrap gap-1">
          {getStatusBadge(business)}
          {business.is_featured && (
            <Badge className="bg-yellow-500">
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (business) => (
        <span className="text-sm text-muted-foreground">
          {business.created_at 
            ? formatDistanceToNow(new Date(business.created_at), { addSuffix: true })
            : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (business) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(`/business/${business.id}`, '_blank')}>
              <Eye className="h-4 w-4 mr-2" />
              View Business
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => toggleFeatureMutation.mutate({ 
                businessId: business.id, 
                feature: !business.is_featured 
              })}
            >
              {business.is_featured ? (
                <>
                  <StarOff className="h-4 w-4 mr-2" />
                  Remove Featured
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Mark as Featured
                </>
              )}
            </DropdownMenuItem>
            {business.approval_status === 'pending' && (
              <>
                <DropdownMenuItem
                  onClick={() => approvalMutation.mutate({ 
                    businessId: business.id, 
                    status: 'approved' 
                  })}
                  className="text-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedBusiness(business);
                    setActionDialog('reject');
                  }}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSelectedBusiness(business);
                setActionDialog('disable');
              }}
              className={business.is_disabled ? 'text-green-600' : 'text-destructive'}
            >
              {business.is_disabled ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enable Business
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Disable Business
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const categoryOptions = Constants.public.Enums.business_category.map((cat) => ({
    value: cat,
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
  }));

  return (
    <AdminLayout 
      title="Business Management" 
      description="Manage business pages, approve listings, and control featured content"
    >
      <DataTable
        columns={columns}
        data={businesses}
        searchPlaceholder="Search businesses..."
        searchKey="name"
        isLoading={isLoading}
        filters={[
          {
            key: 'category',
            label: 'Category',
            options: categoryOptions,
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'featured', label: 'Featured' },
            ],
          },
        ]}
      />

      {/* Disable/Enable Dialog */}
      <Dialog open={actionDialog === 'disable'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedBusiness?.is_disabled ? 'Enable Business' : 'Disable Business'}
            </DialogTitle>
            <DialogDescription>
              {selectedBusiness?.is_disabled 
                ? 'This will restore visibility for this business.'
                : 'This will hide the business from public view.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Business</Label>
              <p className="text-sm text-muted-foreground">{selectedBusiness?.name}</p>
            </div>
            {!selectedBusiness?.is_disabled && (
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for disabling..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedBusiness?.is_disabled ? 'default' : 'destructive'}
              onClick={() => selectedBusiness && disableMutation.mutate({ 
                businessId: selectedBusiness.id, 
                disable: !selectedBusiness.is_disabled 
              })}
              disabled={disableMutation.isPending}
            >
              {selectedBusiness?.is_disabled ? 'Enable' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Business</DialogTitle>
            <DialogDescription>
              This will reject the business application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Business</Label>
              <p className="text-sm text-muted-foreground">{selectedBusiness?.name}</p>
            </div>
            <div>
              <Label htmlFor="reject-reason">Reason for Rejection</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter reason for rejection..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedBusiness && approvalMutation.mutate({ 
                businessId: selectedBusiness.id, 
                status: 'rejected'
              })}
              disabled={approvalMutation.isPending || !actionReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
