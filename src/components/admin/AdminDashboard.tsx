import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { describePushResult, sendNewsPush, takeFlash, type FlashMessage } from '../../lib/sendNewsPush';
import { useAdminAuth } from './useAdminAuth';
import { AdminHeader } from './AdminHeader';

interface Post {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  image_path: string | null;
  status: string;
  send_push: boolean;
  push_sent: boolean;
  created_at: string;
  updated_at: string;
}

export function AdminDashboard() {
  const { profile, isLoading: authLoading } = useAdminAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    setFlash(takeFlash());
  }, []);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('bbrsda_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) fetchPosts();
  }, [authLoading, fetchPosts]);

  async function handleUnpublish(postId: string) {
    setActionLoading(postId);
    const { error } = await supabase
      .from('bbrsda_posts')
      .update({ status: 'draft' })
      .eq('id', postId);

    if (!error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'draft' } : p));
    }
    setActionLoading(null);
  }

  async function handlePublish(postId: string) {
    const post = posts.find(p => p.id === postId);
    const willNotify = !!post?.send_push && !post.push_sent;
    if (
      willNotify &&
      !confirm('Publishing will send a push notification to all app users. This can only be done once per post. Continue?')
    ) {
      return;
    }

    setActionLoading(postId);
    setFlash(null);
    const { error } = await supabase
      .from('bbrsda_posts')
      .update({ status: 'published' })
      .eq('id', postId);

    if (error) {
      setFlash({ type: 'error', message: `Failed to publish: ${error.message}` });
      setActionLoading(null);
      return;
    }

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'published' } : p));

    if (willNotify) {
      try {
        const result = await sendNewsPush(postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, push_sent: true } : p));
        setFlash({ type: 'success', message: `Post published. ${describePushResult(result)}` });
      } catch (err: any) {
        setFlash({
          type: 'error',
          message: `Post published, but the notification failed: ${err.message} Open the post and use "Send Notification Now" to retry.`,
        });
      }
    }
    setActionLoading(null);
  }

  async function handleDelete(postId: string) {
    if (!confirm('Are you sure you want to permanently delete this post?')) return;

    setActionLoading(postId);

    const post = posts.find(p => p.id === postId);
    if (post?.image_path) {
      await supabase.storage.from('bbrsda-post-images').remove([post.image_path]);
    }

    const { error } = await supabase
      .from('bbrsda_posts')
      .delete()
      .eq('id', postId);

    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
    setActionLoading(null);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminHeader profile={profile} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">News Posts</h1>
            <p className="text-text-secondary text-sm mt-1">
              {posts.length} post{posts.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <a
            href="/admin/posts/new"
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors"
          >
            + New Post
          </a>
        </div>

        {flash && (
          <div
            className={`flex items-start justify-between gap-4 text-sm rounded-lg px-4 py-3 mb-6 border ${
              flash.type === 'success'
                ? 'text-success bg-success/10 border-success/20'
                : 'text-error bg-error/10 border-error/20'
            }`}
          >
            <span>{flash.message}</span>
            <button
              type="button"
              onClick={() => setFlash(null)}
              className="opacity-70 hover:opacity-100"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="bg-card border border-divider rounded-2xl p-12 text-center">
            <div className="text-4xl mb-4">📝</div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">No posts yet</h2>
            <p className="text-text-secondary mb-6">Create your first BBRSDA news post to get started.</p>
            <a
              href="/admin/posts/new"
              className="inline-block px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors"
            >
              Create First Post
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-card border border-divider rounded-xl p-5 hover:border-divider/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          post.status === 'published'
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                        }`}
                      >
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      {post.push_sent && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
                          Push Sent
                        </span>
                      )}
                      {post.send_push && !post.push_sent && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-text-tertiary/15 text-text-tertiary">
                          Push Pending
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary truncate">{post.title}</h3>
                    <p className="text-text-secondary text-sm mt-1 line-clamp-2">{post.body}</p>
                    <p className="text-text-tertiary text-xs mt-2">{formatDate(post.created_at)}</p>
                  </div>

                  {post.image_path && (
                    <img
                      src={supabase.storage.from('bbrsda-post-images').getPublicUrl(post.image_path).data.publicUrl}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-divider">
                  <a
                    href={`/admin/posts/edit?id=${post.id}`}
                    className="px-3 py-1.5 text-sm font-medium text-info hover:bg-info/10 rounded-lg transition-colors"
                  >
                    Edit
                  </a>
                  {post.status === 'published' ? (
                    <button
                      onClick={() => handleUnpublish(post.id)}
                      disabled={actionLoading === post.id}
                      className="px-3 py-1.5 text-sm font-medium text-warning hover:bg-warning/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePublish(post.id)}
                      disabled={actionLoading === post.id}
                      className="px-3 py-1.5 text-sm font-medium text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={actionLoading === post.id}
                    className="px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
