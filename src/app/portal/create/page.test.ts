// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const portalActions = vi.hoisted(() => ({
  getPortalCreateOptionsAction: vi.fn(),
}));

const liffState = vi.hoisted(() => ({
  idToken: null as string | null,
  isReady: true,
  error: 'Failed to initialize LIFF: channel mismatch' as string | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/hooks/useLiff', () => ({
  useLiff: () => ({
    ...liffState,
    profile: null,
    login: vi.fn(),
    logout: vi.fn(),
    setMockLogin: vi.fn(),
    canUseMockLogin: false,
  }),
}));

vi.mock('@/app/actions/portalActions', () => ({
  createPortalMediaUploadAction: vi.fn(),
  createPortalTicketAction: vi.fn(),
  finalizePortalMediaAction: vi.fn(),
  getPortalCreateOptionsAction: portalActions.getPortalCreateOptionsAction,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}));

import CreateTicketPage from './page';

describe('Portal create page', () => {
  beforeEach(() => {
    liffState.idToken = null;
    liffState.isReady = true;
    liffState.error = 'Failed to initialize LIFF: channel mismatch';
    portalActions.getPortalCreateOptionsAction.mockReset();
  });

  afterEach(cleanup);

  it('shows a LINE access error instead of an indefinite loader when identity is unavailable', () => {
    const { container } = render(React.createElement(CreateTicketPage));

    expect(screen.getByText('ไม่สามารถเปิดหน้าแจ้งงานได้')).toBeTruthy();
    expect(screen.getByText('กรุณาเปิดเมนูนี้ผ่านแอปพลิเคชัน LINE อีกครั้ง')).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('replaces the loader with a recoverable error when loading ticket options fails', async () => {
    liffState.idToken = 'line-id-token';
    liffState.error = null;
    portalActions.getPortalCreateOptionsAction.mockRejectedValue(new Error('Unauthorized'));

    const { container } = render(React.createElement(CreateTicketPage));

    expect(container.querySelector('.animate-spin')).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText('ไม่สามารถเปิดหน้าแจ้งงานได้')).toBeTruthy();
      expect(screen.getByText('ไม่สามารถตรวจสอบข้อมูลผู้แจ้งงานได้ กรุณาลองเปิดเมนูใหม่อีกครั้ง')).toBeTruthy();
      expect(container.querySelector('.animate-spin')).toBeNull();
    });
  });
});
