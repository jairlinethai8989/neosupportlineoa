/* eslint-disable @typescript-eslint/no-explicit-any */
import * as line from '@line/bot-sdk';

const getLineClient = () => {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  
  if (!channelAccessToken) return null;
  
  return new line.Client({
    channelAccessToken,
    channelSecret: channelSecret || '',
  });
};

/**
 * Send a notification message to the internal LINE group
 */
export async function sendLineGroupNotification(message: string, targetGroupId?: string) {
  const groupId = targetGroupId || process.env.LINE_GROUP_ID;
  const client = getLineClient();
  if (!groupId || !client) return;

  try {
    await client.pushMessage(groupId, {
      type: 'text',
      text: message,
    });
  } catch (error: any) {
    console.error(`Error sending LINE notification to group ${groupId}:`, error.message || error);
  }
}

/**
 * Send a Flex Message notification to the internal LINE group
 */
export async function sendLineGroupFlexNotification(altText: string, contents: any, targetGroupId?: string) {
  const groupId = targetGroupId || process.env.LINE_GROUP_ID;
  const client = getLineClient();
  if (!groupId || !client) return;

  try {
    await client.pushMessage(groupId, {
      type: 'flex',
      altText,
      contents,
    });
  } catch (error: any) {
    console.error(`Error sending LINE Flex notification to group ${groupId}:`, error.message || error);
  }
}
