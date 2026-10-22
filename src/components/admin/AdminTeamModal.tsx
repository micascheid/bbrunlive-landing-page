import { useState, useEffect, useCallback } from 'react';
import {
  createAdminInvite,
  listAdminsAndInvites,
  removeAdminUser,
  revokeAdminInvite,
  type AdminInviteItem,
  type AdminUserItem,
} from '../../lib/adminInvites';

interface AdminTeamModalProps {
  currentUserId: string | undefined;
  onClose: () => void;
}

export function AdminTeamModal({ currentUserId, onClose }: AdminTeamModalProps) {
  const [admins, setAdmins] = useState<AdminUserItem[]>([]);
  const [invites, setInvites] = useState<AdminInviteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form state
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [latestInviteMeta, setLatestInviteMeta] = useState<{
    emailSent: boolean;
    existingAccount: boolean;
    email: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const res = await listAdminsAndInvites();
      setAdmins(res.admins);
      setInvites(res.invites);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin list.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLatestInviteUrl(null);
    setLatestInviteMeta(null);
    setIsCreating(true);

    try {
      const res = await createAdminInvite({
        email: email.trim(),
      });

      setLatestInviteUrl(res.inviteUrl);
      setLatestInviteMeta({
        emailSent: res.emailSent,
        existingAccount: res.existingAccount,
        email: res.invite.email,
      });
      setEmail('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create invite.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      prompt('Copy this invite link:', text);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm('Revoke this pending invite link?')) return;
    setBusyId(inviteId);
    setError('');
    try {
      await revokeAdminInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invite.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveAdmin(admin: AdminUserItem) {
    const label =
      admin.first_name && admin.last_name
        ? `${admin.first_name} ${admin.last_name} (${admin.email})`
        : admin.email || 'this admin';
    if (!confirm(`Remove admin access for ${label}?`)) return;

    setBusyId(admin.user_id);
    setError('');
    try {
      await removeAdminUser(admin.user_id);
      setAdmins((prev) => prev.filter((a) => a.user_id !== admin.user_id));
    } catch (err: any) {
      setError(err.message || 'Failed to remove admin.');
    } finally {
      setBusyId(null);
    }
  }

  function buildInviteUrl(token: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bbrunlive.com';
    return `${origin}/admin/invite?token=${token}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-divider rounded-2xl p-6 shadow-xl my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-divider">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Manage Admins</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Invite BBRSDA team members or manage existing admin access
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleCreateInvite} className="mt-5 space-y-3 bg-surface/50 border border-divider rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary">Invite New Admin</h3>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="colleague@bbrsda.com"
              className="flex-1 px-3 py-2 text-sm bg-card border border-divider rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-info"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {isCreating ? 'Creating...' : 'Create Invite'}
            </button>
          </div>

          {latestInviteUrl && latestInviteMeta && (
            <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/25 text-xs space-y-2">
              <div className="text-success font-medium">
                {latestInviteMeta.emailSent
                  ? `Invite email sent to ${latestInviteMeta.email}! You can also share the direct invite link below:`
                  : latestInviteMeta.existingAccount
                    ? `${latestInviteMeta.email} already has a BB Run Live account. Share this link with them so they can set their admin password:`
                    : `Invite created for ${latestInviteMeta.email}. Share this one-time link with them:`}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={latestInviteUrl}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-card border border-divider rounded text-text-primary select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(latestInviteUrl, 'latest')}
                  className="px-3 py-1.5 bg-accent text-white font-semibold rounded hover:bg-accent/90 transition-colors whitespace-nowrap"
                >
                  {copiedId === 'latest' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-text-secondary">Loading team...</div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Current Admins */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
                Current Admins ({admins.length})
              </h3>
              <div className="divide-y divide-divider border border-divider rounded-xl overflow-hidden bg-surface/30">
                {admins.map((admin) => {
                  const fullName =
                    admin.first_name && admin.last_name
                      ? `${admin.first_name} ${admin.last_name}`
                      : admin.first_name || 'Admin';
                  const isYou = admin.user_id === currentUserId;

                  return (
                    <div
                      key={admin.user_id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate flex items-center gap-2">
                          <span>{fullName}</span>
                          {isYou && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-info/15 text-info font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-secondary truncate">{admin.email}</div>
                      </div>
                      {!isYou && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAdmin(admin)}
                          disabled={busyId === admin.user_id}
                          className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Invites */}
            {invites.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
                  Pending Invites ({invites.length})
                </h3>
                <div className="divide-y divide-divider border border-divider rounded-xl overflow-hidden bg-surface/30">
                  {invites.map((inv) => {
                    const url = buildInviteUrl(inv.token);
                    const name =
                      inv.first_name || inv.last_name
                        ? `${inv.first_name || ''} ${inv.last_name || ''}`.trim()
                        : null;

                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-text-primary truncate">
                            {name ? `${name} (${inv.email})` : inv.email}
                          </div>
                          <div className="text-xs text-text-tertiary">
                            Expires {new Date(inv.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(url, inv.id)}
                            className="px-2.5 py-1 text-xs font-medium text-info hover:bg-info/10 rounded-lg transition-colors"
                          >
                            {copiedId === inv.id ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(inv.id)}
                            disabled={busyId === inv.id}
                            className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
