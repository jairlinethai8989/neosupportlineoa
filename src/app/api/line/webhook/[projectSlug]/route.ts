import { handleLineWebhook } from '@/lib/line/webhookHandler';

export async function POST(
  req: Request,
  context: { params: Promise<{ projectSlug: string }> }
) {
  const { projectSlug } = await context.params;
  return handleLineWebhook(req, projectSlug);
}
