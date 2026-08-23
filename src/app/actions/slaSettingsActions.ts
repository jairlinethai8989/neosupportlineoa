'use server';

import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import { parseSlaRulesInput } from '@/lib/settings/slaRulesSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SLA_RULE_SELECT = 'id, priority, response_time_minutes, resolution_time_minutes, created_at, updated_at';

export async function getSlaRulesAction() {
  await requireStaffAuth();

  const { data, error } = await supabaseAdmin
    .from('sla_rules')
    .select(SLA_RULE_SELECT)
    .order('priority', { ascending: true });

  if (error) throw new Error('Failed to load SLA rules');
  return data || [];
}

export async function saveSlaRulesAction(value: unknown) {
  const staff = await requireStaffAuth({ permission: 'settings_sla', level: 'edit' });
  const rules = parseSlaRulesInput(value);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('sla_rules')
    .select('id');
  if (existingError) throw new Error('Failed to load existing SLA rules');

  const submittedIds = new Set(rules.map((rule) => rule.id).filter(Boolean));
  const idsToDelete = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => id && !submittedIds.has(id));

  for (const id of idsToDelete) {
    const { error } = await supabaseAdmin.from('sla_rules').delete().eq('id', id);
    if (error) throw new Error('Failed to delete SLA rule');
  }

  for (const rule of rules) {
    const payload = {
      priority: rule.priority,
      response_time_minutes: rule.response_time_minutes,
      resolution_time_minutes: rule.resolution_time_minutes,
      updated_at: new Date().toISOString(),
    };

    if (rule.id) {
      const { error } = await supabaseAdmin.from('sla_rules').update(payload).eq('id', rule.id);
      if (error) throw new Error('Failed to update SLA rule');
    } else {
      const { error } = await supabaseAdmin.from('sla_rules').insert([payload]);
      if (error) throw new Error('Failed to create SLA rule');
    }
  }

  await supabaseAdmin.from('system_logs').insert([{
    performer_id: staff.user.id,
    action_type: 'SLA_UPDATE',
    entity_type: 'SLA',
    new_data: { rule_count: rules.length },
    note: `Updated system SLA priority matrix (${rules.length} rules)`,
    created_at: new Date().toISOString(),
  }]);

  return getSlaRulesAction();
}
