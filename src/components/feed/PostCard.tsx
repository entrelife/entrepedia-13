import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerificationBadge } from '@/components/ui/verification-badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CommentSection } from './CommentSection';
import { YouTubeEmbed } from './YouTubeEmbed';

interface PostCardProps {
  post: {
    id: string;
    content: string | null;
    image_url: string | null;
    youtube_url: string | null;
    instagram_url: string | null;
    created_at: string;
    user_id: string;
    profiles: {
      id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
      is_verified?: boolean;
    } | null;
    businesses: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
    post_likes: { user_id: string }[];
    comments: { id: string }[];
  };
  onUpdate: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const isLiked = user ? post.post_likes.some(like => like.user_id === user.id) : false;
  const likeCount = post.post_likes.length;
  const commentCount = post.comments.length;

  const handleLike = async () => {
    if (!user) {
      toast({ title: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    setIsLiking(true);
    try {
      // Use edge function to bypass RLS (since we use custom auth)
      const response = await supabase.functions.invoke('toggle-like', {
        body: {
          user_id: user.id,
          post_id: post.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to toggle like');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      onUpdate();
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `Post by ${post.profiles?.full_name}`,
        text: post.content || 'Check out this post!',
        url: `${window.location.origin}/post/${post.id}`,
      });
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast({ title: 'Link copied to clipboard!' });
    }
  };

  const displayName = post.businesses?.name || post.profiles?.full_name || 'Anonymous';
  const displayAvatar = post.businesses?.logo_url || post.profiles?.avatar_url || '';
  const profileLink = post.businesses 
    ? `/business/${post.businesses.id}` 
    : `/user/${post.profiles?.id}`;

  return (
    <Card className="overflow-hidden card-hover border-0 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Link to={profileLink} className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary/10">
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="gradient-primary text-white">
                {displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground hover:text-primary transition-colors flex items-center">
                {displayName}
                <VerificationBadge isVerified={!!post.profiles?.is_verified} size="sm" />
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={handleShare}>Share</DropdownMenuItem>
              <DropdownMenuItem>Save</DropdownMenuItem>
              {user?.id === post.user_id && (
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Text Content */}
        {post.content && (
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Image */}
        {post.image_url && (
          <div className="rounded-xl overflow-hidden">
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full h-auto object-cover max-h-[500px]"
            />
          </div>
        )}

        {/* YouTube Embed */}
        {post.youtube_url && <YouTubeEmbed url={post.youtube_url} />}

        {/* Instagram Embed Placeholder */}
        {post.instagram_url && (
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Instagram content: {' '}
              <a 
                href={post.instagram_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View on Instagram
              </a>
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col pt-0 border-t">
        {/* Stats */}
        <div className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground">
          <span>{likeCount} likes</span>
          <span>{commentCount} comments</span>
        </div>

        {/* Actions */}
        <div className="w-full flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2', isLiked && 'text-red-500')}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
            Like
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="h-5 w-5" />
            Comment
          </Button>

          <Button variant="ghost" size="sm" className="gap-2" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
            Share
          </Button>

          <Button variant="ghost" size="sm" className="gap-2">
            <Bookmark className="h-5 w-5" />
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="w-full pt-3 border-t mt-2">
            <CommentSection postId={post.id} onCommentAdded={onUpdate} />
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
