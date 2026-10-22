import { PostEditor } from './PostEditor';

export function PostEditorWrapper() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    window.location.href = '/admin/dashboard';
    return null;
  }

  return <PostEditor postId={postId} />;
}
