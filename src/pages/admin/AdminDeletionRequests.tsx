import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Trash2, Clock, AlertTriangle, Loader2, UserX } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface DeletionRequest {
  id: string;
  user_id: string;
  requested_at: string;
  scheduled_deletion_at: string;
  status: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

export default function AdminDeletionRequests() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-deletion-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-account-deletion', {
        body: { action: 'get_all_pending', user_id: 'admin' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return (data?.requests || []) as DeletionRequest[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-account-deletion', {
        body: { 
          action: 'admin_delete_now', 
          user_id: userId,
          admin_id: currentUser?.id
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User account permanently deleted');
      setDeleteDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to delete account: ' + error.message);
    },
  });

  const getTimeRemaining = (scheduledDate: string) => {
    const scheduled = new Date(scheduledDate);
    const now = new Date();
    const diff = scheduled.getTime() - now.getTime();
    
    if (diff <= 0) return 'Overdue';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  };

  const handleDeleteClick = (request: DeletionRequest) => {
    setSelectedRequest(request);
    setDeleteDialogOpen(true);
  };

  return (
    <AdminLayout 
      title="Account Deletion Requests" 
      description="Manage pending account deletion requests. You can delete accounts immediately before the notice period ends."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No pending deletion requests</p>
            <p className="text-sm text-muted-foreground">Users who request account deletion will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="border-destructive/20">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="bg-destructive/10 text-destructive">
                        {request.profiles?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {request.profiles?.full_name || 'Unknown User'}
                      </CardTitle>
                      <CardDescription>
                        @{request.profiles?.username || 'no-username'}
                        {request.profiles?.email && ` • ${request.profiles.email}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Pending Deletion
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Requested: {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trash2 className="h-4 w-4" />
                    <span>Scheduled: {format(new Date(request.scheduled_deletion_at), 'PPp')}</span>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    {getTimeRemaining(request.scheduled_deletion_at)}
                  </Badge>
                </div>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(request)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to permanently delete the account of{' '}
                <strong>{selectedRequest?.profiles?.full_name || 'this user'}</strong> 
                (@{selectedRequest?.profiles?.username}).
              </p>
              <p className="font-medium">This action will immediately:</p>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>Delete all posts, comments, and likes</li>
                <li>Remove all messages and conversations</li>
                <li>Delete business and community memberships</li>
                <li>Remove the user profile permanently</li>
              </ul>
              <p className="mt-3 text-destructive font-medium">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRequest && deleteMutation.mutate(selectedRequest.user_id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Yes, Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
