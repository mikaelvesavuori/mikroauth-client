export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
}

export interface UserInfo {
  email: string;
  lastLogin: string;
  metadata: Record<string, any>;
}

export interface MagicLinkParams {
  token: string;
  email: string;
}

/**
 * Storage provider interface for MikroAuthClient
 */
export interface StorageProvider {
  // All methods are async to accommodate both sync and async implementations
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Default localStorage adapter
 */
export class LocalStorageAdapter implements StorageProvider {
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}

declare global {
  interface Window {
    MikroSafe?: any;
  }
}

export type MikroSafeType = {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  remove(key: string): void;
  clear(): void;
};

/**
 * MikroSafe adapter for encrypted storage
 */
export class MikroSafeAdapter implements StorageProvider {
  private storage: MikroSafeType;

  constructor(password: string) {
    // Try to use the imported version if available
    let MikroSafeClass: any;

    try {
      // Dynamic import to avoid esbuild issues
      MikroSafeClass = require('mikrosafe').MikroSafe;
    } catch (_error) {
      // Fall back to window if available
      MikroSafeClass = window.MikroSafe;
    }

    if (!MikroSafeClass)
      throw new Error('MikroSafe not found. Make sure it is properly loaded.');

    this.storage = new MikroSafeClass(password);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.storage.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return await this.storage.get(key);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.remove(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
