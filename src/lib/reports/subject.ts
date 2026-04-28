export function getTicketSubjectOnly(subject: string | null | undefined, description: string | null | undefined): string {
  const subjectRaw = String(subject ?? '').trim();
  if (!subjectRaw) return '-';

  const descriptionRaw = String(description ?? '').trim();
  if (!descriptionRaw) return subjectRaw;

  const splitIndex = subjectRaw.indexOf(':');
  if (splitIndex <= 0) return subjectRaw;

  const heading = subjectRaw.slice(0, splitIndex).trim();
  const suffix = subjectRaw.slice(splitIndex + 1).trim();
  if (!heading || !suffix) return subjectRaw;

  const normalizedSuffix = suffix.endsWith('...') ? suffix.slice(0, -3).trim() : suffix;
  const isLegacyCombinedSubject =
    descriptionRaw === suffix || descriptionRaw.startsWith(normalizedSuffix);

  return isLegacyCombinedSubject ? heading : subjectRaw;
}

