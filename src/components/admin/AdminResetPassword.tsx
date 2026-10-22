import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { setFlash } from '../../lib/sendNewsPush';
import { ThemeToggle } from './ThemeToggle';

export function AdminResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      // Check if URL has hash tokens (#access_token=...&refresh_token=...) or PKCE ?code=...
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!sessionErr && data.session && mounted) {
          setHasSession(true);
          setIsLoading(false);
          return;
        }
      }

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const { data, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!codeErr && data.session && mounted) {
          setHasSession(true);
          setIsLoading(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setHasSession(!!session);
        setIsLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session && mounted) {
        setHasSession(true);
        setIsLoading(false);
      }
    });

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError || !data.user) {
      setError(updateError?.message || 'Failed to update password. Please request a new reset link.');
      setIsSubmitting(false);
      return;
    }

    const { data: adminRow } = await supabase
      .from('news_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (adminRow) {
      setFlash({ type: 'success', message: 'Your password has been updated.' });
      window.location.href = '/admin/dashboard';
    } else {
      await supabase.auth.signOut();
      window.location.href = '/admin';
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-text-secondary">Verifying reset link...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-end mb-3">
        <ThemeToggle />
      </div>
      <div className="bg-card rounded-2xl p-8 border border-divider">
        <div className="text-center mb-8">
          <img src="/icon.png" alt="BB Run Live" className="w-16 h-16 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary">Set New Password</h1>
          <p className="text-text-secondary text-sm mt-2">
            Choose a new password for your admin account.
          </p>
        </div>

        {!hasSession ? (
          <div className="space-y-4 text-center">
            <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">
              This password reset link is invalid or has expired. Please request a new one from the sign-in page.
            </div>
            <a
              href="/admin"
              className="inline-block w-full py-3 px-4 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors"
            >
              Back to Sign In
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-text-secondary mb-1">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-text-secondary mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                placeholder="Re-enter password"
              />
            </div>

            {error && (
              <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
