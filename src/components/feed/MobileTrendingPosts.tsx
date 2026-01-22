import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrendingPost {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  businesses: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
}

export function MobileTrendingPosts() {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrendingPosts();
  }, []);

  const fetchTrendingPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          user_id,
          profiles:user_id (id, full_name, username, avatar_url),
          businesses:business_id (id, name, logo_url),
          post_likes (id),
          comments (id)
        `)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Calculate engagement and sort
      const postsWithEngagement = (postsData || []).map((post) => ({
        ...post,
        likes_count: post.post_likes?.length || 0,
        comments_count: post.comments?.length || 0,
        engagement: (post.post_likes?.length || 0) * 2 + (post.comments?.length || 0) * 3,
      }));

      const trending = postsWithEngagement
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5);

      setPosts(trending);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-soft lg:hidden">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-32 mb-3" />
          <div className="flex gap-3 overflow-x-auto">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-36 w-40 shrink-0 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) return null;

  return (
    <Card className="border-0 shadow-soft lg:hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Trending Now
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 px-4">
            {posts.map((post, index) => (
              <div
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="relative bg-card border border-border rounded-xl w-44 shrink-0 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="p-3">
                  {/* Header with rank and user */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </span>
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={post.businesses?.logo_url || post.profiles?.avatar_url || ''}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                        {(post.businesses?.name || post.profiles?.full_name || 'U').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {post.businesses?.name || post.profiles?.full_name || 'User'}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-normal leading-relaxed mb-2">
                    {post.content || 'Shared a post'}
                  </p>

                  {/* Image thumbnail if exists */}
                  {post.image_url && (
                    <div
                      className="h-16 rounded-lg bg-cover bg-center mb-2"
                      style={{ backgroundImage: `url(${post.image_url})` }}
                    />
                  )}

                  {/* Engagement stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {post.comments_count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
