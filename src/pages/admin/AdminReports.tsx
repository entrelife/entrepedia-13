import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { MoreHorizontal, CheckCircle, XCircle, Eye, Clock, ExternalLink, EyeOff, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Report {
  id: string;
  reported_type: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string;
  action_taken: string | null;
  created_at: string;
  reporter?: {
    full_name: string | null;
    username: string | null;
  };
}

export default function AdminReports() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionDialog, setActionDialog] = useState<'resolve' | 'dismiss' | null>(null);
  const [actionTaken, setActionTaken] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch reporter profiles separately
      const reportsWithProfiles = await Promise.all((data || []).map(async (report) => {
        if (report.reporter_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('id', report.reporter_id)
            .maybeSingle();
          return { ...report, reporter: profile };
        }
        return { ...report, reporter: null };
      }));
      
      return reportsWithProfiles as Report[];
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status, action }: { reportId: string; status: string; action?: string }) => {
      const { error } = await supabase
        .from('reports')
        .update({ 
          status,
          action_taken: action,
          resolved_by: currentUser?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      await supabase.from('admin_activity_logs').insert({
        admin_id: currentUser?.id,
        action: `${status.charAt(0).toUpperCase() + status.slice(1)} report`,
        target_type: 'report',
        target_id: reportId,
        details: { action },
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success(`Report ${status}`);
      setActionDialog(null);
      setSelectedReport(null);
      setActionTaken('');
    },
    onError: (error) => {
      toast.error('Failed to update report: ' + error.message);
    },
  });

  const hidePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await supabase.functions.invoke('admin-post-actions', {
        body: {
          action: 'hide',
          post_id: postId,
          user_id: currentUser?.id,
          reason: 'Hidden by admin due to report',
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast.success('Post hidden successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (error) => {
      toast.error('Failed to hide post: ' + error.message);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await supabase.functions.invoke('admin-post-actions', {
        body: {
          action: 'delete',
          post_id: postId,
          user_id: currentUser?.id,
          reason: 'Deleted by admin',
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast.success('Post deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (error) => {
      toast.error('Failed to delete post: ' + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Pending</Badge>;
      case 'reviewing':
        return <Badge variant="secondary">Reviewing</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resolved</Badge>;
      case 'dismissed':
        return <Badge variant="secondary">Dismissed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const columns: Column<Report>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (report) => (
        <Badge variant="secondary" className="capitalize">
          {report.reported_type}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (report) => (
        <div>
          <p className="font-medium">{report.reason}</p>
          {report.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {report.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'reporter',
      header: 'Reported By',
      render: (report) => (
        <span className="text-muted-foreground">
          {report.reporter?.full_name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (report) => getStatusBadge(report.status),
    },
    {
      key: 'created_at',
      header: 'Reported',
      render: (report) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (report) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSelectedReport(report)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {report.reported_type === 'post' && (
              <DropdownMenuItem asChild>
                <Link to={`/post/${report.reported_id}`} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Post
                </Link>
              </DropdownMenuItem>
            )}
            {report.status === 'pending' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => updateReportMutation.mutate({ 
                    reportId: report.id, 
                    status: 'reviewing' 
                  })}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Mark as Reviewing
                </DropdownMenuItem>
              </>
            )}
            {report.status !== 'resolved' && report.status !== 'dismissed' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedReport(report);
                    setActionDialog('resolve');
                  }}
                  className="text-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedReport(report);
                    setActionDialog('dismiss');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </DropdownMenuItem>
              </>
            )}
            {report.reported_type === 'post' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => hidePostMutation.mutate(report.reported_id)}
                  className="text-orange-600"
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Post
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm('Are you sure you want to permanently delete this post?')) {
                      deletePostMutation.mutate(report.reported_id);
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Reports & Complaints" 
      description="Review and manage user reports and complaints"
    >
      <DataTable
        columns={columns}
        data={reports}
        searchPlaceholder="Search reports..."
        searchKey="reason"
        isLoading={isLoading}
        filters={[
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'post', label: 'Post' },
              { value: 'user', label: 'User' },
              { value: 'business', label: 'Business' },
              { value: 'community', label: 'Community' },
              { value: 'comment', label: 'Comment' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'reviewing', label: 'Reviewing' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'dismissed', label: 'Dismissed' },
            ],
          },
        ]}
      />

      {/* Resolve Dialog */}
      <Dialog open={actionDialog === 'resolve'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Report</DialogTitle>
            <DialogDescription>
              Describe the action taken to resolve this report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Report Type</Label>
              <p className="text-sm text-muted-foreground capitalize">{selectedReport?.reported_type}</p>
            </div>
            <div>
              <Label>Reason</Label>
              <p className="text-sm text-muted-foreground">{selectedReport?.reason}</p>
            </div>
            <div>
              <Label htmlFor="action">Action Taken</Label>
              <Textarea
                id="action"
                placeholder="Describe what action was taken..."
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedReport && updateReportMutation.mutate({ 
                reportId: selectedReport.id, 
                status: 'resolved',
                action: actionTaken
              })}
              disabled={updateReportMutation.isPending || !actionTaken.trim()}
            >
              Resolve Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Dialog */}
      <Dialog open={actionDialog === 'dismiss'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to dismiss this report?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Report Type</Label>
              <p className="text-sm text-muted-foreground capitalize">{selectedReport?.reported_type}</p>
            </div>
            <div>
              <Label>Reason</Label>
              <p className="text-sm text-muted-foreground">{selectedReport?.reason}</p>
            </div>
            <div>
              <Label htmlFor="dismiss-reason">Reason for Dismissal</Label>
              <Textarea
                id="dismiss-reason"
                placeholder="Enter reason for dismissing..."
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => selectedReport && updateReportMutation.mutate({ 
                reportId: selectedReport.id, 
                status: 'dismissed',
                action: actionTaken
              })}
              disabled={updateReportMutation.isPending}
            >
              Dismiss Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!selectedReport && !actionDialog} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <p className="text-sm text-muted-foreground capitalize">{selectedReport?.reported_type}</p>
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-1">{selectedReport && getStatusBadge(selectedReport.status)}</div>
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <p className="text-sm text-muted-foreground">{selectedReport?.reason}</p>
            </div>
            {selectedReport?.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
              </div>
            )}
            <div>
              <Label>Reported By</Label>
              <p className="text-sm text-muted-foreground">
                {selectedReport?.reporter?.full_name || 'Unknown'} (@{selectedReport?.reporter?.username || 'unknown'})
              </p>
            </div>
            {selectedReport?.action_taken && (
              <div>
                <Label>Action Taken</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.action_taken}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
