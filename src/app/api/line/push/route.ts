/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import * as line from '@line/bot-sdk';

/**
 * Configure LINE SDK client
 */
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'unset',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'unset',
};

const client = new line.Client(config);

/**
 * API Route for Outbound / Push Messages
 * Allows sending messages from the agent dashboard to specific LINE users
 */
export async function POST(req: NextRequest) {
  try {
    const { to, messages } = await req.json();

    if (!to || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        error: 'Invalid Request: Missing "to" userId or "messages" array.' 
      }, { status: 400 });
    }

    if (!config.channelAccessToken) {
      return NextResponse.json({ 
        error: 'Configuration Error: LINE_CHANNEL_ACCESS_TOKEN is not set.' 
      }, { status: 500 });
    }

    // Call LINE Messaging API - Push Message
    // In production, you might want to switch to 'replyMessage' if within the reply window (24h)
    // to save costs/quotas, but for simplicity we use 'pushMessage' as a primary method for agent initiated msgs
    await client.pushMessage(to, messages);

    return NextResponse.json({ 
      status: 'success', 
      message: 'Message sent successfully to LINE.' 
    });

  } catch (error: any) {
    console.error('LINE Messaging API Push Error:', error);
    
    // Check for specific LINE SDK errors if needed
    const status = error.statusCode || 500;
    const errorMessage = error.message || 'Internal Server Error';

    return NextResponse.json({ 
      error: 'Failed to send message via LINE', 
      details: errorMessage 
    }, { status });
  }
}
