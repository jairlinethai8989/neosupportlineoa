import { handleLineWebhook } from '@/lib/line/webhookHandler';

export async function POST(req: Request) {
  return handleLineWebhook(req, null);
}
