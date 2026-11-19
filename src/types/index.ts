// Core domain types for NEO Support

export type TicketStatus = 'New' | 'In Progress' | 'Resolved' | 'Escalated' | 'Pending' | 'Assigned' | 'Closed';
export type MessageType = 'text' | 'image' | 'file' | 'video' | 'audio' | 'sticker' | 'location';
export type SenderType = 'customer' | 'agent' | 'system';
export type Priority = 'High' | 'Medium' | 'Low' | 'Critical';
export type UserRole = 'Admin' | 'Agent';
export type UserStatus = 'Active' | 'Away' | 'Offline';

export interface Profile {
  id: string;
  full_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  department: string | null;
  role: UserRole;
  status: UserStatus;
  updated_at: string;
}

export interface Customer {
  id: string;
  line_user_id: string;
  display_name: string | null;
  hospital_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  metadata?: Record<string, unknown>;
  hospitals?: { name: string } | null;
}

export interface Conversation {
  id: string;
  customer_id: string;
  status: 'active' | 'closed' | 'archived';
  last_message_at: string | null;
  current_ticket_id?: string | null;
  customers?: Customer | null;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  ticket_id: string | null;
  sender_type: SenderType;
  sender_id: string | null;
  content: string | null;
  message_type: MessageType;
  created_at: string;
  line_message_id: string | null;
  media_metadata: Record<string, unknown> | null;
}

export interface Ticket {
  id: string;
  ticket_no: string | number;
  subject: string | null;
  status: TicketStatus | string;
  priority: Priority | string;
  customer_id: string;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_summary: string | null;
  sla_due_at: string | null;
  customers?: Customer | null;
}

export interface TicketLog {
  id: string;
  ticket_id: string;
  action_type: 'claim' | 'status_change' | 'transfer' | 'resolve' | string;
  from_status: string | null;
  to_status: string | null;
  performer_id: string;
  to_user_id: string | null;
  to_team_id: string | null;
  note: string | null;
  created_at: string;
  tickets?: { ticket_no: string | number; subject: string | null } | null;
}

export interface SlaRule {
  id?: string;
  priority: Priority;
  response_time_minutes: number;
  resolution_time_minutes: number;
  created_at?: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  logo_url: string | null;
  departments: string[];
  updated_at: string;
}

export interface CsatSurvey {
  id: string;
  ticket_id: string;
  rating: number | null;
  feedback: string | null;
  sent_at: string;
  completed_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  source: 'ticket_logs' | 'audit_logs';
  action_type: string;
  entity_type: 'ticket' | 'staff' | 'sla' | 'master' | 'system';
  entity_id: string | null;
  ticket_no?: string | number | null;
  subject?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  performer_id: string | null;
  performer_name: string;
  performer_role?: string | null;
  target_user_id?: string | null;
  target_user_name?: string | null;
  note: string | null;
  created_at: string;
}
