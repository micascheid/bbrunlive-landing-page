import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  acceptAdminInvite,
  inspectAdminInvite,
  type InspectInviteResponse,
} from '../../lib/adminInvites';
import { setFlash } from '../../lib/sendNewsPush';
import { ThemeToggle } from './ThemeToggle';

export function AdminAcceptInvite() {
  const [token, setToken] = useState('');
  const [inviteInfo, setInviteInfo] = useState<InspectInviteResponse | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token')?.trim() || '';
      setToken(urlToken);

      if (!urlToken) {
        setInviteError('No invite token was provided in the URL.');
        setIsLoading(false);
        return;
      }

      try {
        const info = await inspectAdminInvite(urlToken);
        setInviteInfo(info);
        setFirstName(info.first_name || '');
        setLastName(info.last_name || '');
      } catch (err: any) {
        setInviteError(err.message || 'This invite link is invalid or has expired.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvite();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await acceptAdminInvite({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      // Sign the user in immediately with their newly configured email & password
      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

      if (signInError) {
        window.location.href = '/admin';
        return;
      }

      setFlash({
        type: 'success',
        message: 'Welcome to the BBRSDA Admin Portal! Your admin access is now active.',
      });
      window.location.href = '/admin/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite. Please try again.');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-text-secondary">Verifying invitation...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-end mb-3">
        <ThemeToggle />
      </div>
      <div className="bg-card rounded-2xl p-8 border border-divider">
        <div className="text-center mb-6">
          <img src="/icon.png" alt="BB Run Live" className="w-16 h-16 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary">Admin Invitation</h1>
          <p className="text-text-secondary text-sm mt-2">
            Set up your BBRSDA News Admin credentials
          </p>
        </div>

        {inviteError || !inviteInfo ? (
          <div className="space-y-4 text-center">
            <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">
              {inviteError || 'Invalid invitation link.'}
            </div>
            <a
              href="/admin"
              className="inline-block w-full py-3 px-4 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors"
            >
              Go to Admin Sign In
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {inviteInfo.existing_account && (
              <div className="text-info text-xs bg-info/10 border border-info/20 rounded-lg px-3.5 py-2.5">
                {inviteInfo.has_password
                  ? 'We found your existing BB Run Live account. Set your password below to activate admin portal access.'
                  : 'Your email is linked to a Google/Apple sign-in on the mobile app. Set a password below so you can sign in to the web Admin Portal (your mobile login will continue to work).'}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Invited Email
              </label>
              <input
                type="email"
                value={inviteInfo.email}
                disabled
                className="w-full px-4 py-3 bg-surface/60 border border-divider rounded-lg text-text-secondary cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-text-secondary mb-1">
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                  placeholder="First name"
                />
              </div>

              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-text-secondary mb-1">
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info transition-colors"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="invite-password" className="block text-sm font-medium text-text-secondary mb-1">
                {inviteInfo.existing_account ? 'Set Admin Password' : 'Create Password'}
              </label>
              <input
                id="invite-password"
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
              <label htmlFor="invite-confirm-password" className="block text-sm font-medium text-text-secondary mb-1">
                Confirm Password
              </label>
              <input
                id="invite-confirm-password"
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
              {isSubmitting ? 'Activating Admin Access...' : 'Accept Invite & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
