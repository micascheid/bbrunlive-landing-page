import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ThemeToggle } from './ThemeToggle';
import { AdminTeamModal } from './AdminTeamModal';

interface AdminProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AdminHeaderProps {
  profile: AdminProfile | null;
}

export function AdminHeader({ profile }: AdminHeaderProps) {
  const [showTeamModal, setShowTeamModal] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/admin';
  }

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email || 'Admin';

  return (
    <>
      <header className="border-b border-divider bg-card/50">
        <nav className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/icon.png" alt="BB Run Live" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-bold text-text-primary">Admin</span>
            </a>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-text-secondary text-sm hidden sm:inline">{displayName}</span>
            <button
              type="button"
              onClick={() => setShowTeamModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface border border-divider rounded-lg transition-colors"
            >
              Admins
            </button>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </nav>
      </header>

      {showTeamModal && (
        <AdminTeamModal
          currentUserId={profile?.id}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </>
  );
}
