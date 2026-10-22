import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface SendNewsPushResult {
  sent: number;
  failed: number;
  removed: number;
  total: number;
}

/** Sends the one-time push notification for a published post. Throws with a readable message on failure. */
export async function sendNewsPush(postId: string): Promise<SendNewsPushResult> {
  const { data, error } = await supabase.functions.invoke<SendNewsPushResult>('send-news-push', {
    body: { postId },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error || 'Failed to send notification.');
    }
    throw new Error(error.message || 'Failed to send notification.');
  }

  return data!;
}

export function describePushResult(result: SendNewsPushResult): string {
  if (result.total === 0) {
    return 'No devices have notifications turned on yet, so nothing was sent.';
  }
  const devices = `${result.sent} device${result.sent === 1 ? '' : 's'}`;
  return result.failed > 0
    ? `Notification sent to ${devices} (${result.failed} could not be reached).`
    : `Notification sent to ${devices}.`;
}

const FLASH_KEY = 'admin.flash';

export interface FlashMessage {
  type: 'success' | 'error';
  message: string;
}

/** Carries a message across the redirect to the dashboard. */
export function setFlash(flash: FlashMessage) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
}

export function takeFlash(): FlashMessage | null {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
