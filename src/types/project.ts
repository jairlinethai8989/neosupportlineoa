export interface ProjectPublicConfig {
  id: string;
  slug: string;
  name: string;
  code: string;
  organization_label: string;
  logo_url: string | null;
  primary_color: string;
  line_liff_id: string | null;
  line_bot_id: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  code: string;
  organization_label: string;
  logo_url: string | null;
  primary_color: string;
  line_liff_id: string | null;
  line_bot_id: string | null;
  line_staff_group_id: string | null;
  notify_on_customer_message: boolean;
  is_default: boolean;
  is_active: boolean;
  project_role?: 'lead' | 'agent' | 'viewer' | 'admin';
}

export interface ProjectCredentials {
  id: string;
  slug: string;
  name: string;
  code: string;
  organization_label: string;
  logo_url: string | null;
  primary_color: string;
  line_channel_id: string | null;
  line_channel_secret: string | null;
  line_channel_access_token: string | null;
  line_liff_id: string | null;
  line_bot_id: string | null;
  line_staff_group_id: string | null;
  notify_on_customer_message: boolean;
  is_default: boolean;
  is_active: boolean;
}

export interface ProjectMemberRecord {
  id: string;
  project_id: string;
  profile_id: string;
  project_role: 'lead' | 'agent' | 'viewer';
  created_at?: string;
}
