import {
  LocalStorageAdapter,
  type MagicLinkParams,
  type StorageProvider,
  type TokenData,
  type UserInfo
} from './interfaces';

/**
 * @description A client-side library for the MikroAuth magic link authentication service.
 */
export class MikroAuthClient {
  private readonly authUrl: string;
  private readonly tokenKey: string;
  private readonly storage: StorageProvider;

  /**
   * @description Initialize the MikroAuth client.
   * Will assume local testing on `http://localhost:3000`
   * unless a value is explicitly provided.
   * @param options Configuration options for MikroAuthClient
   * @param options.authUrl Auth service URL (defaults to http://localhost:3000)
   * @param options.storage Storage provider (defaults to localStorage)
   */
  constructor(options?: {
    authUrl?: string;
    storage?: StorageProvider;
  }) {
    this.authUrl = options?.authUrl || 'http://localhost:3000';
    this.tokenKey = 'mikroauth_tokens';
    this.storage = options?.storage || new LocalStorageAdapter();
  }

  /**
   * @description Save tokens to storage.
   */
  async saveTokens(tokens: Record<string, any>): Promise<void> {
    const tokenData: TokenData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      tokenType: tokens.tokenType || 'Bearer'
    };

    try {
      await this.storage.setItem(this.tokenKey, JSON.stringify(tokenData));
    } catch (_error) {
      throw new Error('Failed to save tokens');
    }
  }

  /**
   * @description Get stored tokens.
   */
  async getTokens(): Promise<TokenData | null> {
    try {
      const data = await this.storage.getItem(this.tokenKey);
      return data ? (JSON.parse(data) as TokenData) : null;
    } catch (_error) {
      throw new Error('Failed to get tokens');
    }
  }

  /**
   * @description Get access token.
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    return tokens ? tokens.accessToken : null;
  }

  /**
   * @description Get refresh token.
   */
  async getRefreshToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    return tokens ? tokens.refreshToken : null;
  }

  /**
   * @description Clear stored tokens.
   */
  async clearTokens(): Promise<void> {
    try {
      await this.storage.removeItem(this.tokenKey);
    } catch (_error) {
      throw new Error('Failed to clear tokens');
    }
  }

  /**
   * @description Check if token is expired.
   */
  async isTokenExpired(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) return true;

    const bufferInSeconds = 10;

    return Date.now() > tokens.expiresAt - bufferInSeconds * 1000;
  }

  /**
   * @description Parse JWT token to get payload.
   */
  private parseToken(token: string): Record<string, any> | null {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (_error) {
      return null;
    }
  }

  /**
   * @description Get user info from the token.
   */
  async getUserInfo(): Promise<UserInfo | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const payload = this.parseToken(token);
    if (!payload) return null;

    return {
      email: payload.sub,
      lastLogin: payload.lastLogin,
      metadata: payload.metadata
    };
  }

  /**
   * @description Check if user is authenticated.
   */
  async isAuthenticated(): Promise<boolean> {
    if (!(await this.getAccessToken())) return false;

    if (await this.isTokenExpired()) {
      try {
        await this.refreshToken();
        return !!(await this.getAccessToken());
      } catch (_error) {
        return false;
      }
    }

    return true;
  }

  /**
   * @description Request a magic link email.
   */
  async requestMagicLink(email: string): Promise<Record<string, any>> {
    const response = await fetch(`${this.authUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to request magic link');
    }

    return await response.json();
  }

  /**
   * @description Verify a magic link token.
   */
  async verifyToken(params: MagicLinkParams): Promise<Record<string, any>> {
    const response = await fetch(`${this.authUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`
      },
      body: JSON.stringify({ email: params.email })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify token');
    }

    const tokenData = await response.json();
    await this.saveTokens(tokenData);
    return tokenData;
  }

  /**
   * @description Refresh the access token.
   */
  async refreshToken(): Promise<Record<string, any>> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    try {
      const response = await fetch(`${this.authUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) throw new Error('Failed to refresh token');

      const tokenData = await response.json();
      await this.saveTokens(tokenData);
      return tokenData;
    } catch (error) {
      await this.clearTokens();
      throw error;
    }
  }

  /**
   * @description Logout the user.
   */
  async logout(): Promise<Record<string, any>> {
    const refreshToken = await this.getRefreshToken();
    const accessToken = await this.getAccessToken();

    if (!refreshToken || !accessToken) {
      await this.clearTokens();
      return { message: 'Logged out successfully' };
    }

    try {
      const response = await fetch(`${this.authUrl}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) throw new Error('Failed to logout');

      const result = await response.json();
      await this.clearTokens();
      return result;
    } catch (error) {
      await this.clearTokens();
      throw error;
    }
  }

  /**
   * @description Get active sessions.
   */
  async getSessions(): Promise<Record<string, any>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.authUrl}/sessions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await this.refreshToken();
          return this.getSessions();
        } catch (_error) {
          throw new Error('Authentication failed');
        }
      }
      throw new Error('Failed to get sessions');
    }

    return await response.json();
  }

  /**
   * @description Handle magic link from URL.
   */
  async handleMagicLink(): Promise<boolean> {
    const urlParams = new URLSearchParams(window?.location?.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) return false;

    try {
      await this.verifyToken({ token, email });

      // Clean URL
      window?.history?.replaceState(
        {},
        document?.title,
        window?.location?.pathname
      );

      return true;
    } catch (error) {
      console.error('Magic link verification failed:', error);
      return false;
    }
  }
}
