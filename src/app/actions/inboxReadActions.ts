'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  getInboxConversationById,
  getInboxConversationByTicketId,
  getInboxTicketById,
  getLatestInboxTicketForConversation,
  listInboxConversations,
  listInboxConversationsFallback,
  listInboxConversationsV2,
  listInboxMessagesPage,
} from '@/lib/inbox/queries';
import {
  parseInboxConversationListInput,
  parseInboxListLimit,
  parseInboxMessagePageInput,
  parseInboxReadId,
} from '@/lib/inbox/inboxReadSecurity';

async function requireInboxRead() {
  await requireStaffAuth({ permission: 'inbox', level: 'view' });
}

async function runInboxRead<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch {
    throw new Error('Failed to load inbox data');
  }
}

export async function listInboxConversationsAction(limitValue: unknown) {
  await requireInboxRead();
  const limit = parseInboxListLimit(limitValue);
  return runInboxRead(() => listInboxConversations(limit));
}

export async function listInboxConversationsFallbackAction(limitValue: unknown) {
  await requireInboxRead();
  const limit = parseInboxListLimit(limitValue);
  return runInboxRead(() => listInboxConversationsFallback(limit));
}

export async function listInboxConversationsV2Action(value: unknown) {
  await requireInboxRead();
  const input = parseInboxConversationListInput(value);
  return runInboxRead(() => listInboxConversationsV2(input));
}

export async function getInboxConversationByIdAction(value: unknown) {
  await requireInboxRead();
  const id = parseInboxReadId(value, 'conversation id');
  return runInboxRead(() => getInboxConversationById(id));
}

export async function getInboxConversationByTicketIdAction(value: unknown) {
  await requireInboxRead();
  const id = parseInboxReadId(value, 'ticket id');
  return runInboxRead(() => getInboxConversationByTicketId(id));
}

export async function listInboxMessagesPageAction(value: unknown) {
  await requireInboxRead();
  const input = parseInboxMessagePageInput(value);
  return runInboxRead(() => listInboxMessagesPage(input));
}

export async function getInboxTicketByIdAction(value: unknown) {
  await requireInboxRead();
  const id = parseInboxReadId(value, 'ticket id');
  return runInboxRead(() => getInboxTicketById(id));
}

export async function getLatestInboxTicketForConversationAction(value: unknown) {
  await requireInboxRead();
  const id = parseInboxReadId(value, 'conversation id');
  return runInboxRead(() => getLatestInboxTicketForConversation(id));
}
