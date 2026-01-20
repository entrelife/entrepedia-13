import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'samrambhak_auth';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { session_token } = JSON.parse(stored);
      return session_token || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function invokeMessaging<T>(action: string, body: Record<string, unknown> = {}): Promise<{ data: T | null; error: Error | null }> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    return { data: null, error: new Error('No session token') };
  }

  try {
    const response = await supabase.functions.invoke('messaging', {
      body: { action, ...body },
      headers: {
        'x-session-token': sessionToken,
      },
    });

    if (response.error) {
      return { data: null, error: new Error(response.error.message) };
    }

    if (response.data?.error) {
      return { data: null, error: new Error(response.data.error) };
    }

    return { data: response.data as T, error: null };
  } catch (error: unknown) {
    return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
  }
}

export interface Conversation {
  id: string;
  participant_one: string | null;
  participant_two: string | null;
  last_message_at: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
  } | null;
  last_message?: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  created_at: string | null;
  is_read: boolean | null;
}

export async function getConversations() {
  return invokeMessaging<{ conversations: Conversation[] }>('get_conversations');
}

export async function getMessages(conversationId: string) {
  return invokeMessaging<{ messages: Message[] }>('get_messages', { conversation_id: conversationId });
}

export async function sendMessage(conversationId: string, content: string) {
  return invokeMessaging<{ message: Message }>('send_message', { conversation_id: conversationId, content });
}

export async function getOrCreateConversation(otherUserId: string) {
  return invokeMessaging<{ conversation_id: string }>('get_or_create_conversation', { other_user_id: otherUserId });
}

export async function deleteConversation(conversationId: string) {
  return invokeMessaging<{ success: boolean }>('delete_conversation', { conversation_id: conversationId });
}

export async function deleteMessage(messageId: string) {
  return invokeMessaging<{ success: boolean }>('delete_message', { message_id: messageId });
}

export async function markMessagesAsRead(conversationId: string) {
  return invokeMessaging<{ success: boolean }>('mark_read', { conversation_id: conversationId });
}
