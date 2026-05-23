export type InboxViewMode = 'list' | 'chat' | 'details';

export interface InboxCustomer {
  id: string;
  display_name: string | null;
  line_user_id: string | null;
  avatar_url?: string | null;
  hospital_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  hospitals?: { id: string; name: string | null } | null;
  departments?: { id: string; name: string | null } | null;
  positions?: { id: string; name: string | null } | null;
}

export interface InboxConversation {
  id: string;
  status: string | null;
  last_message_at: string | null;
  customer_id: string | null;
  current_ticket_id?: string | null;
  is_active?: boolean | null;
  customers?: InboxCustomer | null;
  ticket_data?: {
    id: string;
    ticket_no: string | null;
    subject: string | null;
    status?: string | null;
  } | null;
}

export interface InboxMessage {
  id: string;
  content: string | null;
  sender_type: string | null;
  staff_id: string | null;
  conversation_id: string;
  ticket_id: string | null;
  message_type: string | null;
  media_path?: string | null;
  media_mime_type?: string | null;
  created_at: string;
}

export interface InboxTicket {
  id: string;
  ticket_no: string | null;
  customer_id?: string | null;
  subject: string | null;
  description?: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  module?: string | null;
  issue_type?: string | null;
  escalation_token?: string | null;
}

export interface InboxAgent {
  id: string;
  role?: string | null;
  permissions?: Partial<Record<string, string>> | null;
  quick_replies?: string[] | null;
  resolution_templates?: string[] | null;
}

export interface InboxCompanySettings {
  modules?: string[] | null;
  issue_types?: string[] | null;
  resolution_templates?: string[] | null;
}
