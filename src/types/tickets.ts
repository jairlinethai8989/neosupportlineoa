export type TicketsViewMode = 'board' | 'table';
export type TicketWorkspaceTimeRange =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'custom';

export interface TicketWorkspaceSortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface TicketWorkspaceConversation {
  id: string;
  customer_id: string | null;
  current_ticket_id: string | null;
  status: string | null;
}

export interface TicketWorkspaceHospital {
  id: string;
  name: string | null;
  abbreviation?: string | null;
}

export interface TicketWorkspaceCustomer {
  id: string;
  display_name: string | null;
  full_name?: string | null;
  line_username?: string | null;
}

export interface TicketWorkspaceAssignedAgent {
  id: string;
  display_name: string | null;
}

export interface TicketWorkspaceTicket {
  id: string;
  ticket_no: string | null;
  customer_id: string | null;
  subject: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  module?: string | null;
  issue_type?: string | null;
  hospitals?: TicketWorkspaceHospital | null;
  customers?: TicketWorkspaceCustomer | null;
  assigned_agent?: TicketWorkspaceAssignedAgent | null;
  department_data?: { id: string; name: string } | null;
  current_department_id?: string | null;
  hospital_id?: string | null;
  escalation_token?: string | null;
}

export interface TicketWorkspaceProfile {
  user_id?: string | null;
  role?: string | null;
  permissions?: Partial<Record<string, string>> | null;
  resolution_templates?: string[] | null;
}

export interface TicketWorkspaceCompanySettings {
  id: string | null;
  modules: string[];
  resolution_templates: string[];
  issue_types: string[];
}

export type TicketDetailRole = 'Administrator' | string;

export interface TicketDetailUser {
  id?: string | null;
  display_name?: string | null;
  role?: TicketDetailRole | null;
}

export interface TicketDetailCustomer {
  id?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  line_username?: string | null;
  avatar_url?: string | null;
  hospitals?: { id: string; name: string } | null;
}

export interface TicketDetailAssignedAgent {
  id?: string | null;
  display_name?: string | null;
}

export interface TicketDetailTicket {
  id: string;
  ticket_no: string | null;
  customer_id: string | null;
  status: string | null;
  subject: string | null;
  description: string | null;
  priority: string | null;
  department: string | null;
  module: string | null;
  issue_type: string | null;
  created_at: string | null;
  resolved_at: string | null;
  assigned_agent_id: string | null;
  current_department_id: string | null;
  hospital_id: string | null;
  escalation_token?: string | null;
  resolution_summary?: string | null;
  department_data?: { id: string; name: string } | null;
  customers?: TicketDetailCustomer | null;
  assigned_agent?: TicketDetailAssignedAgent | null;
}

export interface TicketDetailMessage {
  id: string;
  content: string;
  sender_type: 'agent' | 'customer' | 'system' | string;
  staff_id?: string | null;
  ticket_id?: string | null;
  conversation_id?: string | null;
  message_type?: string | null;
  media_path?: string | null;
  media_mime_type?: string | null;
  created_at: string;
}

export interface TicketDetailLog {
  id?: string;
  created_at: string;
  action_type?: string | null;
  to_status?: string | null;
  note?: string | null;
}
