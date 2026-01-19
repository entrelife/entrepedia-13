import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface CommentSectionProps {
  postId: string;
  onCommentAdded: () => void;
}

export function CommentSection({ postId, onCommentAdded }: CommentSectionProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        profiles:user_id (id, full_name, username, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!error && data) {
      setComments(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Please sign in to comment', variant: 'destructive' });
      return;
    }
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      // Use edge function to bypass RLS (since we use custom auth)
      const response = await supabase.functions.invoke('create-comment', {
        body: {
          user_id: user.id,
          post_id: postId,
          content: newComment.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create comment');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setNewComment('');
      fetchComments();
      onCommentAdded();
    } catch (error: any) {
      toast({ title: 'Error posting comment', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      {user && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="gradient-primary text-white text-sm">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !newComment.trim()}
              className="gradient-primary text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            <Link to={`/user/${comment.profiles?.id}`}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.profiles?.avatar_url || ''} />
                <AvatarFallback className="gradient-secondary text-white text-sm">
                  {comment.profiles?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1">
              <div className="bg-muted rounded-xl px-3 py-2">
                <Link 
                  to={`/user/${comment.profiles?.id}`}
                  className="font-semibold text-sm hover:text-primary"
                >
                  {comment.profiles?.full_name || 'Anonymous'}
                </Link>
                <p className="text-sm text-foreground">{comment.content}</p>
              </div>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
