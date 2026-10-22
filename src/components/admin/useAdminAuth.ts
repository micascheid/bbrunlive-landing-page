import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AdminAuthState {
  user: User | null;
  profile: AdminProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export function useAdminAuth(): AdminAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (mounted) {
          setIsLoading(false);
          window.location.href = '/admin';
        }
        return;
      }

      if (mounted) setUser(session.user);

      const { data: adminRow } = await supabase
        .from('news_admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .single();

      if (!adminRow) {
        if (mounted) {
          setIsLoading(false);
          await supabase.auth.signOut();
          window.location.href = '/admin';
        }
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', session.user.id)
        .single();

      if (mounted) {
        setProfile(profileData);
        setIsAdmin(true);
        setIsLoading(false);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/admin';
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, isAdmin, isLoading };
}
