const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_PATTERN = /^[A-Z0-9_:-]{1,80}$/;

export type AuditLogFilters = {
  agentId?: string;
  actionType?: string;
  limit: number;
};

export function parseAuditLogFilters(value: unknown): AuditLogFilters {
  if (value === undefined || value === null) return { limit: 50 };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid audit log filters');
  }

  const input = value as Record<string, unknown>;
  const allowedKeys = new Set(['agentId', 'actionType', 'limit']);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error('Invalid audit log filters');
  }

  const result: AuditLogFilters = { limit: 50 };
  if (input.agentId !== undefined && input.agentId !== 'all') {
    const agentId = String(input.agentId).trim();
    if (!UUID_PATTERN.test(agentId)) throw new Error('Invalid audit log filters');
    result.agentId = agentId;
  }

  if (input.actionType !== undefined && input.actionType !== 'all') {
    const actionType = String(input.actionType).trim().toUpperCase();
    if (!ACTION_PATTERN.test(actionType)) throw new Error('Invalid audit log filters');
    result.actionType = actionType;
  }

  if (input.limit !== undefined) {
    const limit = Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid audit log filters');
    result.limit = Math.min(limit, 200);
  }

  return result;
}
