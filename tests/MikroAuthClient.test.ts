import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MikroAuthClient } from '../src/MikroAuthClient';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => {
      return store[key] || null;
    }),
    setItem: vi.fn((key: string, value: string): void => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key];
    }),
    clear: vi.fn((): void => {
      store = {};
    })
  };
})();

// Mock Response class
class MockResponse {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    this.status = status;
    this.body = body;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  async json() {
    return this.body;
  }
}

// Test data
const mockTokenData = {
  accessToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibGFzdExvZ2luIjoiMjAyMy0wMS0wMVQwMDowMDowMFoiLCJtZXRhZGF0YSI6eyJuYW1lIjoiVGVzdCBVc2VyIn0sImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjQyNjIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  refreshToken: 'refresh_token_value',
  expiresIn: 3600,
  expiresAt: Date.now() + 3600 * 1000,
  tokenType: 'Bearer'
};

let client: MikroAuthClient;

// Save original objects to restore later
const originalFetch = global.fetch;
const originalLocalStorage = global.localStorage;
const originalWindow = global.window;
const originalConsoleError = console.error;

beforeEach(() => {
  // Mock localStorage
  // @ts-ignore
  global.localStorage = localStorageMock;
  localStorage.clear();

  // Mock window
  global.window = {
    location: {
      search: '',
      pathname: '/test'
    },
    history: {
      replaceState: vi.fn()
    }
  } as any;

  // Initialize client
  client = new MikroAuthClient({ authUrl: 'https://auth.example.com' });

  // Mock console.error
  console.error = vi.fn();

  // Mock fetch
  // @ts-ignore
  global.fetch = vi.fn((url, _options) => {
    if (url.includes('/verify')) {
      return Promise.resolve(
        new MockResponse(200, {
          accessToken: mockTokenData.accessToken,
          refreshToken: mockTokenData.refreshToken,
          expiresIn: mockTokenData.expiresIn,
          tokenType: mockTokenData.tokenType
        })
      );
    }

    if (url.includes('/refresh'))
      return Promise.resolve(
        new MockResponse(200, {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresIn: 3600,
          tokenType: 'Bearer'
        })
      );

    if (url.includes('/logout'))
      return Promise.resolve(
        new MockResponse(200, { message: 'Logged out successfully' })
      );

    if (url.includes('/sessions'))
      return Promise.resolve(new MockResponse(200, { sessions: [] }));

    if (url.includes('/login'))
      return Promise.resolve(
        new MockResponse(200, { message: 'Magic link sent' })
      );

    return Promise.resolve(new MockResponse(404, { message: 'Not found' }));
  });
});

afterEach(() => {
  // Restore original objects
  global.fetch = originalFetch;
  global.localStorage = originalLocalStorage;
  global.window = originalWindow;
  console.error = originalConsoleError;

  // Clear mocks
  vi.clearAllMocks();
});

describe('Token Management', () => {
  test('It should save tokens to localStorage', async () => {
    await client.saveTokens({
      accessToken: mockTokenData.accessToken,
      refreshToken: mockTokenData.refreshToken,
      expiresIn: mockTokenData.expiresIn,
      tokenType: mockTokenData.tokenType
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mikroauth_tokens',
      expect.any(String)
    );

    const setItemCall = vi.mocked(localStorage.setItem).mock.calls[0];
    const savedData = JSON.parse(setItemCall[1]);

    expect(savedData.accessToken).toBe(mockTokenData.accessToken);
    expect(savedData.refreshToken).toBe(mockTokenData.refreshToken);
  });

  test('It should get tokens from localStorage', async () => {
    const tokenString = JSON.stringify(mockTokenData);
    vi.mocked(localStorage.getItem).mockReturnValueOnce(tokenString);

    const tokens = await client.getTokens();

    expect(localStorage.getItem).toHaveBeenCalledWith('mikroauth_tokens');
    expect(tokens).not.toBeNull();
    expect(tokens!.accessToken).toBe(mockTokenData.accessToken);
    expect(tokens!.refreshToken).toBe(mockTokenData.refreshToken);
  });

  test('It should return null when no tokens are stored', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    const tokens = await client.getTokens();

    expect(tokens).toBeNull();
  });

  test('It should get access token', async () => {
    const tokenString = JSON.stringify(mockTokenData);
    vi.mocked(localStorage.getItem).mockReturnValueOnce(tokenString);

    const accessToken = await client.getAccessToken();

    expect(accessToken).toBe(mockTokenData.accessToken);
  });

  test('It should get refresh token', async () => {
    const tokenString = JSON.stringify(mockTokenData);
    vi.mocked(localStorage.getItem).mockReturnValueOnce(tokenString);

    const refreshToken = await client.getRefreshToken();

    expect(refreshToken).toBe(mockTokenData.refreshToken);
  });

  test('It should clear tokens from localStorage', async () => {
    await client.clearTokens();

    expect(localStorage.removeItem).toHaveBeenCalledWith('mikroauth_tokens');
  });
});

describe('Authentication Status', () => {
  test('It should detect expired tokens', async () => {
    const expiredToken = {
      ...mockTokenData,
      expiresAt: Date.now() - 1000 // expired 1 second ago
    };

    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(expiredToken)
    );

    const isExpired = await client.isTokenExpired();

    expect(isExpired).toBe(true);
  });

  test('It should detect valid tokens', async () => {
    const validToken = {
      ...mockTokenData,
      expiresAt: Date.now() + 3600 * 1000 // valid for 1 hour
    };

    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(validToken)
    );

    const isExpired = await client.isTokenExpired();

    expect(isExpired).toBe(false);
  });

  test('It should consider no token as expired', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    const isExpired = await client.isTokenExpired();

    expect(isExpired).toBe(true);
  });

  test('It should check authentication status with valid token', async () => {
    const validToken = {
      ...mockTokenData,
      expiresAt: Date.now() + 3600 * 1000 // valid for 1 hour
    };

    // Add mocks for BOTH calls
    vi.mocked(localStorage.getItem)
      .mockReturnValueOnce(JSON.stringify(validToken)) // First call: getAccessToken
      .mockReturnValueOnce(JSON.stringify(validToken)); // Second call: isTokenExpired

    const isAuthenticated = await client.isAuthenticated();

    expect(isAuthenticated).toBe(true);
  });

  test('It should try to refresh expired token during authentication check', async () => {
    // First call for isAuthenticated -> getAccessToken
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );

    // Second call for isTokenExpired
    const expiredToken = {
      ...mockTokenData,
      expiresAt: Date.now() - 1000 // expired 1 second ago
    };
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(expiredToken)
    );

    // Third call for refreshToken -> getRefreshToken
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(expiredToken)
    );

    const isAuthenticated = await client.isAuthenticated();

    expect(isAuthenticated).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/refresh'),
      expect.any(Object)
    );
  });

  test('It should return false for authentication when no token exists', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    const isAuthenticated = await client.isAuthenticated();

    expect(isAuthenticated).toBe(false);
  });
});

describe('User Info', () => {
  test('It should extract user info from JWT token', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );

    const userInfo = await client.getUserInfo();

    expect(userInfo).not.toBeNull();
    expect(userInfo!.email).toBe('test@example.com');
    expect(userInfo!.metadata).toEqual({ name: 'Test User' });
  });

  test('It should return null when no token exists', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    const userInfo = await client.getUserInfo();

    expect(userInfo).toBeNull();
  });
});

describe('API Interactions', () => {
  test('It should request a magic link', async () => {
    const result = await client.requestMagicLink('test@example.com');

    expect(result.message).toBe('Magic link sent');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })
    );
  });

  test('It should verify a token', async () => {
    const result = await client.verifyToken({
      token: 'verification_token',
      email: 'test@example.com'
    });

    expect(result.accessToken).toBe(mockTokenData.accessToken);
    expect(result.refreshToken).toBe(mockTokenData.refreshToken);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/verify'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer verification_token'
        }),
        body: JSON.stringify({ email: 'test@example.com' })
      })
    );
  });

  test('It should refresh tokens', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );

    const result = await client.refreshToken();

    expect(result.accessToken).toBe('new_access_token');
    expect(result.refreshToken).toBe('new_refresh_token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/refresh'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: mockTokenData.refreshToken })
      })
    );
  });

  test('It should throw an error when refreshing with no token', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    await expect(client.refreshToken()).rejects.toThrow(
      'No refresh token available'
    );
  });

  test('It should logout', async () => {
    // Mock for getRefreshToken
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );
    // Mock for getAccessToken
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );

    const result = await client.logout();

    expect(result.message).toBe('Logged out successfully');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockTokenData.accessToken}`
        }),
        body: JSON.stringify({ refreshToken: mockTokenData.refreshToken })
      })
    );
    expect(localStorage.removeItem).toHaveBeenCalledWith('mikroauth_tokens');
  });

  test('It should handle logout when no tokens exist', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);

    const result = await client.logout();

    expect(result.message).toBe('Logged out successfully');
    expect(localStorage.removeItem).toHaveBeenCalledWith('mikroauth_tokens');
  });

  test('It should get sessions', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(
      JSON.stringify(mockTokenData)
    );

    const result = await client.getSessions();

    expect(result.sessions).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sessions'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockTokenData.accessToken}`
        })
      })
    );
  });

  test('It should throw an error when getting sessions without authentication', async () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce(null);

    await expect(client.getSessions()).rejects.toThrow('Not authenticated');
  });
});

describe('Magic Link Handling', () => {
  test('It should return false when URL params are missing', async () => {
    window.location.search = '?other=param';

    const result = await client.handleMagicLink();

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
