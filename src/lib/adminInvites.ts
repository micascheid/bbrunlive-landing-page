import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AdminUserItem {
  user_id: string;
  created_at: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface AdminInviteItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface ListAdminsResponse {
  admins: AdminUserItem[];
  invites: AdminInviteItem[];
}

export interface CreateInviteResponse {
  invite: AdminInviteItem;
  inviteUrl: string;
  emailSent: boolean;
  existingAccount: boolean;
}

export interface InspectInviteResponse {
  email: string;
  first_name: string;
  last_name: string;
  existing_account: boolean;
  has_password: boolean;
  expires_at: string;
}

async function invokeManageAdminInvite<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('manage-admin-invite', {
    body,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const errBody = await error.context.json().catch(() => null);
      throw new Error(errBody?.error || 'Request failed.');
    }
    throw new Error(error.message || 'Request failed.');
  }

  return data!;
}

export function listAdminsAndInvites(): Promise<ListAdminsResponse> {
  return invokeManageAdminInvite<ListAdminsResponse>({ action: 'list' });
}

export function createAdminInvite(params: {
  email: string;
}): Promise<CreateInviteResponse> {
  return invokeManageAdminInvite<CreateInviteResponse>({
    action: 'create-invite',
    email: params.email,
    siteOrigin: typeof window !== 'undefined' ? window.location.origin : 'https://bbrunlive.com',
  });
}

export function revokeAdminInvite(inviteId: string): Promise<{ success: boolean }> {
  return invokeManageAdminInvite<{ success: boolean }>({
    action: 'revoke-invite',
    inviteId,
  });
}

export function removeAdminUser(userId: string): Promise<{ success: boolean }> {
  return invokeManageAdminInvite<{ success: boolean }>({
    action: 'remove-admin',
    userId,
  });
}

export function inspectAdminInvite(token: string): Promise<InspectInviteResponse> {
  return invokeManageAdminInvite<InspectInviteResponse>({
    action: 'inspect-invite',
    token,
  });
}

export function acceptAdminInvite(params: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<{ success: boolean; email: string }> {
  return invokeManageAdminInvite<{ success: boolean; email: string }>({
    action: 'accept-invite',
    ...params,
  });
}
