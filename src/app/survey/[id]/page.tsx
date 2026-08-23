import { redirect } from 'next/navigation';
import { createPortalSurveyPath } from '@/lib/portal/surveyPath';

export default async function LegacySurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(createPortalSurveyPath(id));
}
