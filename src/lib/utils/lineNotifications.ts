/* eslint-disable @typescript-eslint/no-explicit-any */
import * as line from '@line/bot-sdk';
import { getReportBroadcastSettings } from '@/lib/reports/broadcastSettings';

const getLineClient = () => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  
  if (!channelAccessToken || channelAccessToken === 'unset') return null;
  
  return new line.Client({
    channelAccessToken,
    channelSecret: channelSecret || '',
  });
};

/**
 * Send one or more LINE messages to a specific customer (LINE User ID).
 * Fails silently with a boolean result so core DB flows are never blocked.
 */
export async function sendLineUserNotification(
  lineUserId: string | null | undefined,
  messages: line.Message | line.Message[]
): Promise<boolean> {
  const targetUserId = lineUserId?.trim();
  if (!targetUserId || targetUserId.startsWith('U_MOCK_')) return false;

  const client = getLineClient();
  if (!client) return false;

  try {
    await client.pushMessage(targetUserId, messages);
    return true;
  } catch (error: any) {
    console.error(`Error sending LINE push message to user ${targetUserId}:`, error?.message || error);
    return false;
  }
}

/**
 * Send a notification message to the configured internal LINE staff group (from company_settings).
 */
export async function notifyStaffGroupIfConfigured(message: string): Promise<boolean> {
  try {
    const settings = await getReportBroadcastSettings();
    if (!settings.groupId) return false;
    return await sendLineGroupNotification(message, settings.groupId);
  } catch (error: any) {
    console.error('Error resolving staff LINE group settings:', error?.message || error);
    return false;
  }
}

/**
 * Send a notification message to the internal LINE group
 */
export async function sendLineGroupNotification(message: string, targetGroupId?: string) {
  const groupId = targetGroupId;
  const client = getLineClient();
  if (!groupId || !client) return false;

  try {
    await client.pushMessage(groupId, {
      type: 'text',
      text: message,
    });
    return true;
  } catch (error: any) {
    console.error(`Error sending LINE notification to group ${groupId}:`, error.message || error);
    return false;
  }
}

/**
 * Send a Flex Message notification to the internal LINE group
 */
export async function sendLineGroupFlexNotification(altText: string, contents: any, targetGroupId?: string) {
  const groupId = targetGroupId;
  const client = getLineClient();
  if (!groupId || !client) return false;

  try {
    await client.pushMessage(groupId, {
      type: 'flex',
      altText,
      contents,
    });
    return true;
  } catch (error: any) {
    console.error(`Error sending LINE Flex notification to group ${groupId}:`, error.message || error);
    return false;
  }
}
