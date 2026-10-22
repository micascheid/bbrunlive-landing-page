import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ThemeToggle } from './ThemeToggle';

export function AdminLogin() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: adminRow } = await supabase
          .from('news_admins')
          .select('user_id')
          .eq('user_id', session.user.id)
          .single();

        if (adminRow) {
          window.location.href = '/admin/dashboard';
          return;
        }
      }
      setIsLoading(false);
    }
    checkExistingSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Invalid email or password.');
      setIsSubmitting(false);
      return;
    }

    if (!data.user) {
      setError('Sign in failed. Please try again.');
      setIsSubmitting(false);
      return;
    }

    const { data: adminRow } = await supabase
      .from('news_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .single();

    if (!adminRow) {
      setError('You do not have admin access.');
      await supabase.auth.signOut();
      setIsSubmitting(false);
      return;
    }

    window.location.href = '/admin/dashboard';
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResetSuccess(false);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      setIsSubmitting(false);
      return;
    }

    const redirectTo = `${window.location.origin}/admin/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message || 'Failed to send password reset email.');
      setIsSubmitting(false);
      return;
    }

    setResetSuccess(true);
    setIsSubmitting(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-text-secondary">Loading...</div>
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
          <h1 className="text-2xl font-bold text-text-primary">
            {mode === 'login' ? 'Admin Portal' : 'Reset Password'}
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            {mode === 'login'
              ? 'BBRSDA News Management'
              : 'Enter your admin email to receive a password reset link.'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetSuccess(false);
                    setMode('forgot');
                  }}
                  className="text-xs font-medium text-info hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                placeholder="••••••••"
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
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-text-secondary mb-1">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {resetSuccess && (
              <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3">
                If an account exists for <strong className="font-semibold">{email.trim()}</strong>, a password reset link has been sent. Check your inbox.
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setResetSuccess(false);
                setMode('login');
              }}
              className="w-full py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
