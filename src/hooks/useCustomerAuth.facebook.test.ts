import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture options passed to signInWithOAuth so we can assert on them.
let capturedOptions: any = null;
let mockUrl =
  'https://xxucasikopqtcztbgfbw.supabase.co/auth/v1/authorize' +
  '?provider=facebook' +
  '&redirect_to=https%3A%2F%2Fwww.shadamonshop.com%2Fauth%2Fcallback' +
  '&scope=email+public_profile';

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOAuth: vi.fn(async (args: any) => {
          capturedOptions = args?.options ?? null;
          return { data: { url: mockUrl, provider: args?.provider }, error: null };
        }),
        signOut: vi.fn(),
        signInWithPassword: vi.fn(),
      },
      rpc: vi.fn(),
      functions: { invoke: vi.fn() },
    },
  };
});

import { useCustomerAuth } from './useCustomerAuth';

const FORBIDDEN = ['config_id', 'business_config_id', 'pages_', 'whatsapp_', 'business_management'];

function findForbidden(url: string): string[] {
  return FORBIDDEN.filter((k) => url.includes(k));
}

function hasDuplicateScopeTokens(url: string): boolean {
  const u = new URL(url);
  const scope = u.searchParams.get('scope') || '';
  const tokens = scope.split(/\s+/).filter(Boolean);
  return new Set(tokens).size !== tokens.length;
}

describe('customer Facebook OAuth URL', () => {
  beforeEach(() => {
    capturedOptions = null;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        origin: 'https://www.shadamonshop.com',
        assign: vi.fn(),
        href: 'https://www.shadamonshop.com/account/login',
      },
    });
  });

  it('passes correct redirectTo and no custom scopes/business params', async () => {
    const { result } = renderHook(() => useCustomerAuth());
    await act(async () => {
      await result.current.signInWithProvider('facebook');
    });

    expect(capturedOptions).toBeTruthy();
    expect(capturedOptions.redirectTo).toBe('https://www.shadamonshop.com/auth/callback');
    expect(capturedOptions.scopes).toBeUndefined();
    for (const k of ['config_id', 'business_config_id', 'pages_scope', 'whatsapp_business_management', 'business_management']) {
      expect(capturedOptions[k]).toBeUndefined();
    }
  });

  it('navigates to a well-formed Supabase authorize URL', async () => {
    const { result } = renderHook(() => useCustomerAuth());
    await act(async () => {
      await result.current.signInWithProvider('facebook');
    });

    const assignMock = window.location.assign as unknown as ReturnType<typeof vi.fn>;
    expect(assignMock).toHaveBeenCalledTimes(1);
    const navigated = assignMock.mock.calls[0][0] as string;

    const u = new URL(navigated);
    expect(u.searchParams.get('provider')).toBe('facebook');
    expect(u.searchParams.get('redirect_to')).toBe('https://www.shadamonshop.com/auth/callback');

    const scope = u.searchParams.get('scope') || '';
    const tokens = scope.split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(expect.arrayContaining(['email', 'public_profile']));
    expect(new Set(tokens).size).toBe(tokens.length); // no duplicates

    expect(findForbidden(navigated)).toEqual([]);
  });

  it('validator helpers catch a malicious URL (regression guard)', () => {
    const bad =
      'https://example.com/authorize?provider=facebook' +
      '&redirect_to=https%3A%2F%2Fwww.shadamonshop.com%2Fauth%2Fcallback' +
      '&scope=email+email+public_profile' +
      '&config_id=12345' +
      '&pages_show_list=1';

    expect(hasDuplicateScopeTokens(bad)).toBe(true);
    expect(findForbidden(bad).sort()).toEqual(['config_id', 'pages_'].sort());
  });
});
