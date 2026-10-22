import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { describePushResult, sendNewsPush, setFlash } from '../../lib/sendNewsPush';
import { useAdminAuth } from './useAdminAuth';
import { AdminHeader } from './AdminHeader';
import { ImageCropper } from './ImageCropper';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_DIMENSION = 1600;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TITLE_RECOMMENDED_LENGTH = 50;
const TITLE_MAX_LENGTH = 100;

interface PostEditorProps {
  postId?: string;
}

interface PostData {
  title: string;
  body: string;
  link_url: string;
  link_label: string;
  send_push: boolean;
}

export function PostEditor({ postId }: PostEditorProps) {
  const { user, profile, isLoading: authLoading } = useAdminAuth();
  const isEditing = !!postId;

  const [form, setForm] = useState<PostData>({
    title: '',
    body: '',
    link_url: '',
    link_label: '',
    send_push: false,
  });
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string>('draft');
  const [existingPushSent, setExistingPushSent] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing || authLoading) return;

    async function loadPost() {
      const { data, error } = await supabase
        .from('bbrsda_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error || !data) {
        window.location.href = '/admin/dashboard';
        return;
      }

      setForm({
        title: data.title,
        body: data.body,
        link_url: data.link_url || '',
        link_label: data.link_label || '',
        send_push: data.send_push,
      });
      setExistingImagePath(data.image_path);
      setExistingStatus(data.status);
      setExistingPushSent(data.push_sent);

      if (data.image_path) {
        const { data: urlData } = supabase.storage
          .from('bbrsda-post-images')
          .getPublicUrl(data.image_path);
        setImagePreview(urlData.publicUrl);
      }

      setIsLoading(false);
    }

    loadPost();
  }, [isEditing, postId, authLoading]);

  function handleChange(field: keyof PostData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccessMessage('');
  }

  async function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
          resolve(file);
          return;
        }
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to resize image'));
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Image must be JPEG, PNG, or WebP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 5 MB.');
      return;
    }

    setImageFile(file);
    setCroppedBlob(null);
    setRemoveImage(false);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const handleCroppedBlob = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
  }, []);

  function handleRemoveImage() {
    setImageFile(null);
    setCroppedBlob(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validateForm(): string | null {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.body.trim()) return 'Body text is required.';
    if (!form.link_url.trim()) {
      return form.link_label.trim() ? 'Add a Link URL or clear the Link Label.' : null;
    }
    try {
      const url = new URL(form.link_url.trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'Link must start with http:// or https://';
      }
    } catch {
      return 'Please enter a valid URL.';
    }
    return null;
  }

  async function uploadImage(file: File): Promise<string> {
    const blobToUpload = croppedBlob ?? (await resizeImage(file));
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `posts/${fileName}`;

    const { error } = await supabase.storage
      .from('bbrsda-post-images')
      .upload(filePath, blobToUpload, { contentType: file.type });

    if (error) throw new Error(`Image upload failed: ${error.message}`);
    return filePath;
  }

  async function finishPublish(id: string) {
    if (form.send_push && !existingPushSent) {
      try {
        const result = await sendNewsPush(id);
        setFlash({ type: 'success', message: `Post published. ${describePushResult(result)}` });
      } catch (err: any) {
        setFlash({
          type: 'error',
          message: `Post published, but the notification failed: ${err.message} Open the post and use "Send Notification Now" to retry.`,
        });
      }
    } else {
      setFlash({ type: 'success', message: 'Post published.' });
    }
    window.location.href = '/admin/dashboard';
  }

  async function handleSave(publishAction: 'draft' | 'publish') {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (
      publishAction === 'publish' &&
      form.send_push &&
      !existingPushSent &&
      !confirm('Publishing will send a push notification to all app users. This can only be done once per post. Continue?')
    ) {
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      let imagePath = isEditing ? existingImagePath : null;

      if (removeImage && existingImagePath) {
        await supabase.storage.from('bbrsda-post-images').remove([existingImagePath]);
        imagePath = null;
      }

      if (imageFile) {
        if (existingImagePath && !removeImage) {
          await supabase.storage.from('bbrsda-post-images').remove([existingImagePath]);
        }
        imagePath = await uploadImage(imageFile);
      }

      const postData = {
        title: form.title.trim(),
        body: form.body.trim(),
        link_url: form.link_url.trim() || null,
        link_label: (form.link_url.trim() && form.link_label.trim()) || null,
        image_path: imagePath,
        status: publishAction === 'publish' ? 'published' : 'draft',
        send_push: form.send_push,
      };

      if (isEditing) {
        const { data: updated, error, count } = await supabase
          .from('bbrsda_posts')
          .update(postData)
          .eq('id', postId)
          .select();

        if (error) throw new Error(error.message);
        if (!updated || updated.length === 0) {
          throw new Error('Update failed — you may not have permission to edit this post.');
        }

        if (publishAction === 'publish') {
          await finishPublish(postId!);
          return;
        }

        setExistingImagePath(imagePath);
        setExistingStatus(postData.status);
        setImageFile(null);
        setRemoveImage(false);
        setSuccessMessage('Draft saved!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const { data: inserted, error } = await supabase
          .from('bbrsda_posts')
          .insert({ ...postData, author_id: user!.id })
          .select();

        if (error) throw new Error(error.message);
        if (!inserted || inserted.length === 0) {
          throw new Error('Failed to create post — you may not have admin access.');
        }

        if (publishAction === 'publish') {
          await finishPublish(inserted[0].id);
          return;
        }
        setFlash({ type: 'success', message: 'Draft saved.' });
        window.location.href = '/admin/dashboard';
      }
    } catch (err: any) {
      console.error('[PostEditor] Save error:', err);
      setError(err.message || 'Something went wrong.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendPushNow() {
    if (!confirm('Send a push notification to all users for this post? This can only be done once.')) return;
    setIsSaving(true);
    setError('');

    setSuccessMessage('');

    try {
      const result = await sendNewsPush(postId!);
      setExistingPushSent(true);
      setForm(prev => ({ ...prev, send_push: true }));
      setSuccessMessage(describePushResult(result));
    } catch (err: any) {
      setError(err.message || 'Failed to send notification.');
    } finally {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setIsSaving(false);
    }
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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/admin/dashboard" className="text-text-tertiary hover:text-text-secondary text-sm transition-colors">
              ← Back to Dashboard
            </a>
            <h1 className="text-2xl font-bold text-text-primary mt-2">
              {isEditing ? 'Edit Post' : 'New Post'}
            </h1>
          </div>
        </div>

        {error && (
          <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 mb-6">
            {successMessage}
          </div>
        )}

        <div className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="title" className="block text-sm font-medium text-text-secondary">
                Title <span className="text-error">*</span>
              </label>
              <span
                className={`text-xs font-medium ${
                  form.title.length > TITLE_RECOMMENDED_LENGTH
                    ? 'text-warning'
                    : 'text-text-tertiary'
                }`}
              >
                {form.title.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              id="title"
              type="text"
              value={form.title}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
              placeholder="Post title"
            />
            <p className="text-text-tertiary text-xs mt-1">
              Used as the push notification heading — keep under ~{TITLE_RECOMMENDED_LENGTH} characters so it doesn't get cut off on phone lock screens.
            </p>
          </div>

          {/* Body */}
          <div>
            <label htmlFor="body" className="block text-sm font-medium text-text-secondary mb-1.5">
              Body <span className="text-error">*</span>
            </label>
            <textarea
              id="body"
              value={form.body}
              onChange={(e) => handleChange('body', e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors resize-y"
              placeholder="Write your post content here..."
            />
          </div>

          {/* Link URL */}
          <div>
            <label htmlFor="link_url" className="block text-sm font-medium text-text-secondary mb-1.5">
              Link URL <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <input
              id="link_url"
              type="url"
              value={form.link_url}
              onChange={(e) => handleChange('link_url', e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
              placeholder="https://example.com/article"
            />
          </div>

          {/* Link Label */}
          <div>
            <label htmlFor="link_label" className="block text-sm font-medium text-text-secondary mb-1.5">
              Link Label <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <input
              id="link_label"
              type="text"
              value={form.link_label}
              onChange={(e) => handleChange('link_label', e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
              placeholder="e.g. Read the full article"
            />
            <p className="text-text-tertiary text-xs mt-1">If left empty, the domain name will be shown.</p>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Image <span className="text-text-tertiary font-normal">(optional)</span>
            </label>

            {imagePreview && !removeImage ? (
              imageFile ? (
                <ImageCropper
                  sourceUrl={imagePreview}
                  mimeType={imageFile.type}
                  previewTitle={form.title}
                  previewBody={form.body}
                  onCroppedBlob={handleCroppedBlob}
                  onRemove={handleRemoveImage}
                />
              ) : (
                <div className="bg-surface/50 border border-divider rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Mobile Feed Card Preview (3:2 Frame)
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 border border-error/20 rounded-lg transition-colors"
                    >
                      Remove Image
                    </button>
                  </div>
                  <div className="max-w-sm mx-auto bg-card border border-divider rounded-xl overflow-hidden shadow-md">
                    <div style={{ aspectRatio: '3 / 2' }} className="w-full overflow-hidden bg-background/40">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-base font-semibold text-text-primary line-clamp-1">
                        {form.title.trim() || 'Your post title will appear here'}
                      </div>
                      <div className="text-sm text-text-secondary mt-1 line-clamp-2">
                        {form.body.trim() || 'A 3-line preview of your post body text will appear here on the mobile feed card.'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : null}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="px-4 py-2 bg-surface border border-divider rounded-lg text-text-secondary hover:text-text-primary hover:border-info cursor-pointer transition-colors text-sm"
              >
                {imagePreview && !removeImage ? 'Replace Image' : 'Choose Image'}
              </label>
              <span className="text-text-tertiary text-xs">JPEG, PNG, or WebP • Max 5 MB • 3:2 ratio (~1200×800px) recommended</span>
            </div>
          </div>

          {/* Push Notification Toggle */}
          <div className="bg-card border border-divider rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Send Push Notification</h3>
                <p className="text-text-tertiary text-xs mt-0.5">
                  {existingPushSent
                    ? 'A notification was already sent for this post.'
                    : 'Users will receive a notification when this post is published.'}
                </p>
              </div>
              {isEditing && existingPushSent ? (
                <span className="px-3 py-1 rounded-lg text-xs font-medium bg-info/15 text-info">
                  Already Sent
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleChange('send_push', !form.send_push)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    form.send_push ? 'bg-accent' : 'bg-surface border border-divider'
                  }`}
                  role="switch"
                  aria-checked={form.send_push}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      form.send_push ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Send Push Now button for already-published posts that haven't sent a push */}
            {isEditing && existingStatus === 'published' && !existingPushSent && (
              <div className="mt-4 pt-4 border-t border-divider">
                <button
                  onClick={handleSendPushNow}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-info hover:bg-info/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Sending...' : 'Send Notification Now'}
                </button>
                <p className="text-text-tertiary text-xs mt-1">
                  Send a one-time push notification for this published post.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-divider">
            <button
              onClick={() => handleSave('draft')}
              disabled={isSaving}
              className="px-5 py-2.5 bg-surface border border-divider hover:border-info text-text-primary font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSave('publish')}
              disabled={isSaving}
              className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Publishing...' : isEditing ? 'Update & Publish' : 'Publish'}
            </button>
            <a
              href="/admin/dashboard"
              className="px-5 py-2.5 text-text-secondary hover:text-text-primary font-medium rounded-lg transition-colors ml-auto"
            >
              Cancel
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
