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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Send a notification message to the internal LINE group
 */
export async function sendLineGroupNotification(message: string) {
  const groupId = process.env.LINE_GROUP_ID;
  const client = getLineClient();
  if (!groupId || !client) return;

  try {
    await client.pushMessage(groupId, {
      type: 'text',
      text: message,
    });
  } catch (error: unknown) {
    console.error('Error sending LINE group notification:', getErrorMessage(error));
    const err = error as { originalError?: { response?: { data?: unknown } } };
    if (err?.originalError?.response?.data) {
       console.error('LINE API Detailed Error:', JSON.stringify(err.originalError.response.data));
    }
  }
}

/**
 * Send a Flex Message notification to the internal LINE group
 */
export async function sendLineGroupFlexNotification(altText: string, contents: Record<string, unknown>) {
  const groupId = process.env.LINE_GROUP_ID;
  const client = getLineClient();
  if (!groupId || !client) {
    console.warn('LINE_GROUP_ID or ACCESS_TOKEN not set. Flex Notification skipped.');
    return;
  }

  try {
    await client.pushMessage(groupId, {
      type: 'flex',
      altText,
      contents: contents as unknown as line.FlexContainer,
    });
  } catch (error: unknown) {
    console.error('Error sending LINE group Flex notification:', getErrorMessage(error));
  }
}
