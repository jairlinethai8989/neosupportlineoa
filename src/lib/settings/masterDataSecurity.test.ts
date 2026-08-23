import { describe, expect, it } from 'vitest';
import { parseMasterCreateInput, parseMasterUpdateInput, toMasterDataDto } from './masterDataSecurity';

describe('master data input security', () => {
  it('maps an organization create request to an allowlisted table payload', () => {
    expect(parseMasterCreateInput({ tab: 'organizations', name: '  Hospital A  ', abbreviation: ' HA ' })).toEqual({
      table: 'organizations', tab: 'organizations',
      payload: { name: 'Hospital A', abbreviation: 'HA', ticket_prefix: 'SRS_HA_', is_active: true },
    });
  });

  it('maps a department without accepting a client table name', () => {
    expect(parseMasterCreateInput({ tab: 'departments', name: ' Support ' })).toEqual({
      table: 'departments', tab: 'departments',
      payload: { name: 'Support', dept_type: 'organization', is_active: true },
    });
  });

  it('rejects unknown tabs and malformed line group IDs', () => {
    expect(() => parseMasterCreateInput({ tab: 'profiles', name: 'Admin' })).toThrow('Invalid master data');
    expect(() => parseMasterCreateInput({ tab: 'line_groups', name: 'Group', abbreviation: 'bad value!' })).toThrow('Invalid master data');
  });

  it('validates update IDs and returns only mutable columns', () => {
    expect(parseMasterUpdateInput({
      tab: 'positions', id: '8b000000-0000-0000-0000-000000000001', name: ' Manager ', abbreviation: 'ignored',
    })).toEqual({
      table: 'positions', tab: 'positions', id: '8b000000-0000-0000-0000-000000000001', payload: { name: 'Manager' },
    });
  });

  it('returns an allowlisted organization DTO without future private columns', () => {
    expect(toMasterDataDto('organizations', {
      id: '8b000000-0000-0000-0000-000000000001',
      name: 'Hospital A',
      is_active: true,
      abbreviation: 'HA',
      ticket_prefix: 'SRS_HA_',
      private_token: 'secret',
    })).toEqual({
      id: '8b000000-0000-0000-0000-000000000001',
      name: 'Hospital A',
      is_active: true,
      abbreviation: 'HA',
      ticket_prefix: 'SRS_HA_',
    });
  });
});
