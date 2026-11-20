/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import * as line from '@line/bot-sdk';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveProjectBySlug } from '@/lib/projects/projectResolver';

const MENU_KEYWORDS = new Set(['menu', 'help', 'portal', 'เมนู', 'แจ้งงาน', 'ขอเมนู']);
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://neoworkspace.vercel.app').replace(/\/$/, '');
const IMAGEMAP_BASE_URL =
  process.env.LINE_PORTAL_IMAGEMAP_BASE_URL || `${APP_BASE_URL}/line/imagemap-portal-menu`;
const PORTAL_PROMPT_COOLDOWN_MS = 5 * 60 * 1000;
const portalPromptCooldown = new Map<string, number>();

function shouldSendPortalPrompt(projectKey: string, lineUserId: string): boolean {
  const key = `${projectKey}:${lineUserId}`;
  const now = Date.now();
  const lastSentAt = portalPromptCooldown.get(key) || 0;
  if (now - lastSentAt < PORTAL_PROMPT_COOLDOWN_MS) {
    return false;
  }
  portalPromptCooldown.set(key, now);
  if (portalPromptCooldown.size > 500) {
    for (const [uid, ts] of portalPromptCooldown.entries()) {
      if (now - ts >= PORTAL_PROMPT_COOLDOWN_MS) {
        portalPromptCooldown.delete(uid);
      }
    }
  }
  return true;
}

function normalizeIncomingText(text: string) {
  return text.trim().toLowerCase();
}

function buildPortalUrls(project: {
  slug: string;
  is_default: boolean;
  line_bot_id: string | null;
}) {
  const querySuffix = project.is_default ? '' : `?project=${encodeURIComponent(project.slug)}`;
  const portalUrl = `${APP_BASE_URL}/portal${querySuffix}`;
  const createUrl = `${APP_BASE_URL}/portal/create${querySuffix}`;
  const botId = project.line_bot_id?.trim() || process.env.NEXT_PUBLIC_LINE_BOT_ID?.trim();
  const contactUrl = botId ? `https://line.me/R/ti/p/${encodeURIComponent(botId)}` : portalUrl;
  return { portalUrl, createUrl, historyUrl: portalUrl, contactUrl };
}

function buildPortalImagemapMessage(urls: ReturnType<typeof buildPortalUrls>): line.ImageMapMessage {
  return {
    type: 'imagemap',
    baseUrl: IMAGEMAP_BASE_URL,
    altText: 'Neo Support Portal Menu',
    baseSize: { width: 1040, height: 356 },
    actions: [
      { type: 'uri', linkUri: urls.portalUrl, area: { x: 0, y: 0, width: 347, height: 356 } },
      { type: 'uri', linkUri: urls.createUrl, area: { x: 347, y: 0, width: 347, height: 356 } },
      { type: 'uri', linkUri: urls.contactUrl, area: { x: 694, y: 0, width: 346, height: 356 } },
    ],
  };
}

function buildPortalFallbackText(
  projectName: string,
  urls: ReturnType<typeof buildPortalUrls>
): line.TextMessage {
  return {
    type: 'text',
    text:
      `เมนูบริการลูกค้า (${projectName})\n` +
      `แจ้งปัญหาใหม่: ${urls.createUrl}\n` +
      `ดูสถานะ/ประวัติ: ${urls.historyUrl}\n` +
      `ติดต่อเจ้าหน้าที่: ${urls.contactUrl}\n\n` +
      'พิมพ์ "เมนู" เพื่อเรียกเมนูนี้อีกครั้ง',
  };
}

async function replyPortalEntry(
  client: line.Client,
  replyToken: string,
  projectName: string,
  urls: ReturnType<typeof buildPortalUrls>
) {
  try {
    await client.replyMessage(replyToken, [
      buildPortalImagemapMessage(urls),
      buildPortalFallbackText(projectName, urls),
    ]);
  } catch (error) {
    console.error('Webhook: Failed to send imagemap entry menu', error);
    await client.replyMessage(replyToken, buildPortalFallbackText(projectName, urls));
  }
}

async function getLineProfileSnapshot(client: line.Client, userId: string) {
  try {
    const profile = await client.getProfile(userId);
    return {
      display_name: profile.displayName || 'LINE User',
      avatar_url: profile.pictureUrl || null,
    };
  } catch (error) {
    console.warn(`Webhook: Failed to fetch LINE profile for ${userId}`, error);
    return {
      display_name: 'LINE User',
      avatar_url: null,
    };
  }
}

async function upsertProjectCustomerProfile(input: {
  projectId: string | null;
  line_user_id: string;
  display_name: string;
  avatar_url: string | null;
  metadata?: Record<string, unknown>;
}) {
  const baseMetadata: Record<string, unknown> = {
    ...(input.metadata || {}),
    line_profile: {
      display_name: input.display_name,
      picture_url: input.avatar_url,
      synced_at: new Date().toISOString(),
    },
  };

  // Look up existing customer within this project first so we support partial unique indexes cleanly
  let existingQuery = supabaseAdmin
    .from('customers')
    .select('id')
    .eq('line_user_id', input.line_user_id);

  if (input.projectId) {
    existingQuery = existingQuery.eq('project_id', input.projectId);
  }

  const { data: existingCustomer } = await existingQuery.limit(1).maybeSingle();
  const payload: Record<string, unknown> = {
    line_user_id: input.line_user_id,
    display_name: input.display_name,
    avatar_url: input.avatar_url,
    metadata: baseMetadata,
    updated_at: new Date().toISOString(),
  };
  if (input.projectId) {
    payload.project_id = input.projectId;
  }

  const executeWrite = async (rowPayload: Record<string, unknown>) => {
    if (existingCustomer?.id) {
      return supabaseAdmin
        .from('customers')
        .update(rowPayload)
        .eq('id', existingCustomer.id)
        .select('id, display_name, line_user_id, avatar_url, metadata')
        .single();
    }
    return supabaseAdmin
      .from('customers')
      .insert([rowPayload])
      .select('id, display_name, line_user_id, avatar_url, metadata')
      .single();
  };

  let { data, error } = await executeWrite(payload);

  if (error && error.code === 'PGRST204' && String(error.message || '').includes('avatar_url')) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.avatar_url;
    const fallback = await executeWrite(fallbackPayload);
    data = fallback.data;
    error = fallback.error;
  }

  return { data, error };
}

export async function handleLineWebhook(req: Request, projectSlug: string | null) {
  const project = await resolveProjectBySlug(projectSlug);
  if (!project) {
    return NextResponse.json({ error: 'Unknown or inactive project' }, { status: 404 });
  }

  const channelSecret = project.line_channel_secret || 'unset';
  const channelAccessToken = project.line_channel_access_token || 'unset';

  const signature = req.headers.get('x-line-signature');
  const rawBody = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Signature required' }, { status: 401 });
  }

  const checkSig = crypto
    .createHmac('SHA256', channelSecret)
    .update(rawBody)
    .digest('base64');

  if (checkSig !== signature) {
    console.error(`Webhook (${project.slug}): Invalid signature`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const client = new line.Client({ channelAccessToken, channelSecret });
  const portalUrls = buildPortalUrls(project);
  const resolvedProjectId = project.id === 'default-env-fallback' ? null : project.id;

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error('Webhook: Non-JSON body received');
    return NextResponse.json({ error: 'Body required' }, { status: 400 });
  }

  const events: any[] = body.events || [];
  if (events.length === 0) {
    return NextResponse.json({ status: 'ok' });
  }

  for (const event of events) {
    if (event.type === 'follow') {
      if (event.replyToken) {
        await replyPortalEntry(client, event.replyToken, project.name, portalUrls);
      }
      continue;
    }

    if (event.type === 'message' && event.message.type === 'text') {
      const text = normalizeIncomingText(event.message.text);
      if (MENU_KEYWORDS.has(text)) {
        await replyPortalEntry(client, event.replyToken, project.name, portalUrls);
        continue;
      }
      if (text === 'get group id') {
        const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
        try {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `ID ของกลุ่ม/แชทนี้คือ (${project.name}):\n${sourceId}`,
          });
        } catch (e) {
          console.error('Reply ID failed:', e);
        }
        continue;
      }
    }

    if (event.type === 'message') {
      if (event.source.type !== 'user') {
        continue;
      }

      const lineUserId = event.source.userId;
      if (!lineUserId) continue;

      const messageText =
        event.message.type === 'text' ? event.message.text : `[Attachment: ${event.message.type}]`;
      const lineProfile = await getLineProfileSnapshot(client, lineUserId);

      const { data: customer, error: customerUpsertError } = await upsertProjectCustomerProfile({
        projectId: resolvedProjectId,
        line_user_id: lineUserId,
        display_name: lineProfile.display_name,
        avatar_url: lineProfile.avatar_url,
        metadata: { original_event: event },
      });

      if (customerUpsertError || !customer) {
        console.error('Webhook: customer profile sync failed:', customerUpsertError);
        continue;
      }

      let convQuery = supabaseAdmin
        .from('conversations')
        .select('id, current_ticket_id')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .not('current_ticket_id', 'is', null);

      if (resolvedProjectId) {
        convQuery = convQuery.eq('project_id', resolvedProjectId);
      }

      const { data: conversation } = await convQuery
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conversation) {
        if (event.replyToken && shouldSendPortalPrompt(project.slug, lineUserId)) {
          try {
            await replyPortalEntry(client, event.replyToken, project.name, portalUrls);
          } catch (replyErr) {
            console.error('Webhook: Failed to send portal entry prompt:', replyErr);
          }
        }
        continue;
      }

      const { error: messageError } = await supabaseAdmin.from('messages').insert([
        {
          conversation_id: conversation.id,
          ticket_id: conversation.current_ticket_id,
          sender_type: 'customer',
          customer_id: customer.id,
          content:
            event.message.type === 'text'
              ? messageText
              : `[${event.message.type.toUpperCase()} Attachment]`,
          line_message_id: event.message.id,
          line_uid: event.source.userId,
          message_type:
            event.message.type === 'text'
              ? 'text'
              : ['image', 'video', 'file', 'audio'].includes(event.message.type)
                ? event.message.type
                : 'text',
        },
      ]);

      if (messageError) {
        if (messageError.code === '23505') {
          continue;
        }
        console.error('Webhook: Message insert error:', messageError);
        continue;
      }

      if (['image', 'video', 'file', 'audio'].includes(event.message.type)) {
        try {
          let buffer: Buffer;
          if (event.message.contentProvider?.type === 'external') {
            const res = await fetch(event.message.originalContentUrl);
            const arrayBuffer = await res.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          } else {
            const responseStream: any = await client.getMessageContent(event.message.id);
            buffer = await new Promise<Buffer>((resolve, reject) => {
              const chunks: Buffer[] = [];
              responseStream.on('data', (chunk: Buffer) => chunks.push(chunk));
              responseStream.on('end', () => resolve(Buffer.concat(chunks)));
              responseStream.on('error', (err: any) => reject(err));
            });
          }

          let fileExt = 'bin';
          let contentType = 'application/octet-stream';

          if (event.message.type === 'image') {
            const sig = buffer.slice(0, 4).toString('hex');
            if (sig === '89504e47') {
              fileExt = 'png';
              contentType = 'image/png';
            } else if (sig.startsWith('ffd8ff')) {
              fileExt = 'jpg';
              contentType = 'image/jpeg';
            } else if (buffer.slice(0, 4).toString('ascii') === 'RIFF') {
              fileExt = 'webp';
              contentType = 'image/webp';
            } else {
              fileExt = 'jpg';
              contentType = 'image/jpeg';
            }
          } else if (event.message.type === 'video') {
            fileExt = 'mp4';
            contentType = 'video/mp4';
          } else if (event.message.type === 'audio') {
            fileExt = 'm4a';
            contentType = 'audio/x-m4a';
          }

          const fileName = `customer/${customer.id}/${event.message.id}_${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('chat_media')
            .upload(fileName, buffer, {
              contentType,
              cacheControl: '3600',
              upsert: true,
            });

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabaseAdmin.storage.from('chat_media').getPublicUrl(fileName);

            await supabaseAdmin
              .from('messages')
              .update({
                media_path: publicUrl,
                media_mime_type: contentType,
              })
              .eq('line_message_id', event.message.id);
          }
        } catch (err) {
          console.error('Webhook: Media Fetch Error:', err);
        }
      }

      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
