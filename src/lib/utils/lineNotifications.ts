/* eslint-disable @typescript-eslint/no-explicit-any */
import * as line from '@line/bot-sdk';
import { getReportBroadcastSettings } from '@/lib/reports/broadcastSettings';
import { resolveProjectById } from '@/lib/projects/projectResolver';

const getEnvLineClient = () => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || channelAccessToken === 'unset') return null;

  return new line.Client({
    channelAccessToken,
    channelSecret: channelSecret || '',
  });
};

async function getProjectLineClient(projectId?: string | null): Promise<{
  client: line.Client | null;
  staffGroupId: string | null;
  notifyOnCustomerMessage: boolean;
}> {
  if (projectId) {
    const project = await resolveProjectById(projectId);
    if (project) {
      const token = project.line_channel_access_token;
      const client =
        token && token !== 'unset'
          ? new line.Client({
              channelAccessToken: token,
              channelSecret: project.line_channel_secret || '',
            })
          : getEnvLineClient();

      return {
        client,
        staffGroupId: project.line_staff_group_id || null,
        notifyOnCustomerMessage: Boolean(project.notify_on_customer_message),
      };
    }
  }

  return {
    client: getEnvLineClient(),
    staffGroupId: null,
    notifyOnCustomerMessage: false,
  };
}

/**
 * Send one or more LINE messages to a specific customer (LINE User ID) using the project's LINE OA.
 * Fails silently with a boolean result so core DB flows are never blocked.
 */
export async function sendLineUserNotification(
  lineUserId: string | null | undefined,
  messages: line.Message | line.Message[],
  projectId?: string | null
): Promise<boolean> {
  const targetUserId = lineUserId?.trim();
  if (!targetUserId || targetUserId.startsWith('U_MOCK_')) return false;

  const { client } = await getProjectLineClient(projectId);
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
 * Send a notification message to the configured internal LINE staff group for a project (or global fallback).
 */
export async function notifyStaffGroupIfConfigured(
  message: string,
  projectId?: string | null
): Promise<boolean> {
  try {
    const { client, staffGroupId } = await getProjectLineClient(projectId);
    let targetGroupId = staffGroupId;

    if (!targetGroupId) {
      const settings = await getReportBroadcastSettings();
      targetGroupId = settings.groupId || null;
    }

    if (!targetGroupId || !client) return false;

    await client.pushMessage(targetGroupId, {
      type: 'text',
      text: message,
    });
    return true;
  } catch (error: any) {
    console.error('Error resolving staff LINE group settings:', error?.message || error);
    return false;
  }
}

/**
 * Checks whether a project opted in to LINE staff group push alerts on routine customer chat messages.
 */
export async function shouldNotifyStaffGroupOnMessage(projectId?: string | null): Promise<boolean> {
  if (!projectId) return false;
  const project = await resolveProjectById(projectId);
  return Boolean(project?.notify_on_customer_message);
}

/**
 * Send a notification message to a specific internal LINE group.
 */
export async function sendLineGroupNotification(
  message: string,
  targetGroupId?: string,
  projectId?: string | null
) {
  const groupId = targetGroupId;
  const { client } = await getProjectLineClient(projectId);
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
 * Send a Flex Message notification to a specific internal LINE group.
 */
export async function sendLineGroupFlexNotification(
  altText: string,
  contents: any,
  targetGroupId?: string,
  projectId?: string | null
) {
  const groupId = targetGroupId;
  const { client } = await getProjectLineClient(projectId);
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
