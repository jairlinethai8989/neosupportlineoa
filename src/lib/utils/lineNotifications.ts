/* eslint-disable @typescript-eslint/no-explicit-any */
import * as line from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

/**
 * Send a notification message to the internal LINE group
 */
export async function sendLineGroupNotification(message: string) {
  const groupId = process.env.LINE_GROUP_ID; // We'll need to set this after joining the bot to the group
  if (!groupId || !config.channelAccessToken) {
    console.warn('LINE_GROUP_ID or ACCESS_TOKEN not set. Notification skipped.');
    return;
  }

  try {
    await client.pushMessage(groupId, {
      type: 'text',
      text: message,
    });
  } catch (error) {
    console.error('Error sending LINE group notification:', error);
  }
}

/**
 * Send a Flex Message notification to the internal LINE group
 */
export async function sendLineGroupFlexNotification(altText: string, contents: any) {
  const groupId = process.env.LINE_GROUP_ID;
  if (!groupId || !config.channelAccessToken) {
    console.warn('LINE_GROUP_ID or ACCESS_TOKEN not set. Flex Notification skipped.');
    return;
  }

  try {
    await client.pushMessage(groupId, {
      type: 'flex',
      altText,
      contents,
    });
  } catch (error) {
    console.error('Error sending LINE group Flex notification:', error);
  }
}
