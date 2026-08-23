const AUTO_LOGOUT_MINUTES = new Set([0, 5, 15, 30, 60, 120]);

function parseOptionalHttpsUrl(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (text.length > 2048) throw new Error(`Invalid ${field}`);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`Invalid ${field}`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`Invalid ${field}`);
  }
  return url.toString();
}

function parseTemplateList(value: unknown, maxLength: number) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid profile templates');
  return value.map((entry) => {
    if (typeof entry !== 'string' || entry.length > maxLength) {
      throw new Error('Invalid profile templates');
    }
    return entry;
  });
}

export function parseOwnProfileSettings(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid profile settings');
  }
  const input = value as Record<string, unknown>;
  const fullName = String(input.full_name ?? '').trim();
  const department = input.department == null ? null : String(input.department).trim();
  const landingPage = input.landing_page == null || input.landing_page === ''
    ? null
    : String(input.landing_page);
  const themeColor = input.theme_color == null ? null : String(input.theme_color);
  const autoLogoutMinutes = Number(input.auto_logout_minutes ?? 0);

  if (fullName.length < 1 || fullName.length > 200) throw new Error('Invalid full name');
  if (department && department.length > 200) throw new Error('Invalid department');
  if (landingPage !== null && landingPage !== 'dashboard' && landingPage !== 'inbox') {
    throw new Error('Invalid landing page');
  }
  if (themeColor !== null && !/^#[0-9a-f]{6}$/i.test(themeColor)) {
    throw new Error('Invalid theme color');
  }
  if (!Number.isInteger(autoLogoutMinutes) || !AUTO_LOGOUT_MINUTES.has(autoLogoutMinutes)) {
    throw new Error('Invalid auto logout');
  }

  return {
    full_name: fullName,
    avatar_url: parseOptionalHttpsUrl(input.avatar_url, 'avatar URL'),
    department: department || null,
    landing_page: landingPage as 'dashboard' | 'inbox' | null,
    theme_color: themeColor,
    signature_url: parseOptionalHttpsUrl(input.signature_url, 'signature URL'),
    quick_replies: parseTemplateList(input.quick_replies ?? [], 2000),
    resolution_templates: parseTemplateList(input.resolution_templates ?? [], 5000),
    auto_logout_minutes: autoLogoutMinutes as 0 | 5 | 15 | 30 | 60 | 120,
  };
}

export function parseOwnProfileTemplateUpdate(typeValue: unknown, value: unknown) {
  const type = String(typeValue ?? '').trim();
  if (type !== 'quick' && type !== 'res') throw new Error('Invalid profile template type');
  return {
    type: type as 'quick' | 'res',
    values: parseTemplateList(value, type === 'quick' ? 2000 : 5000),
  };
}
