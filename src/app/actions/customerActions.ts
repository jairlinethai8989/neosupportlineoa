'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseCustomerId, toCustomerDto, toCustomerTicketDto } from '@/lib/customers/customerSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CUSTOMER_SELECT = `
  id, display_name, full_name, line_username, line_user_id, avatar_url, status,
  organization_id, department_id, position_id, created_at,
  organizations(name), departments(name), positions(name)
`;

export async function getCustomersAction() {
  await requireStaffAuth({ permission: 'customers', level: 'view' });
  const primary = await supabaseAdmin
    .from('customers')
    .select(CUSTOMER_SELECT)
    .order('created_at', { ascending: false });
  let rows: unknown[] | null = primary.data;
  let error = primary.error;

  if (error) {
    const fallback = await supabaseAdmin
      .from('customers')
      .select('id, display_name, full_name, line_username, line_user_id, status, organization_id, department_id, position_id, created_at, metadata')
      .order('created_at', { ascending: false });
    rows = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error('Failed to load customers');
  return (rows || []).map((row) => toCustomerDto(row as Record<string, unknown>));
}

export async function getCustomerTicketsAction(value: unknown) {
  await requireStaffAuth({ permission: 'customers', level: 'view' });
  const customerId = parseCustomerId(value);
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_no, subject, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Failed to load customer tickets');
  return (data || []).map((row) => toCustomerTicketDto(row as Record<string, unknown>));
}
