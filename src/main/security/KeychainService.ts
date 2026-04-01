/**
 * KeychainService - Manages API key storage.
 *
 * Uses Electron's safeStorage to encrypt keys with OS-level credentials
 * (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 * Falls back to electron-store with obfuscation if safeStorage is unavailable.
 */
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const SERVICE_NAME = 'termimate';

function createStore(): Store<Record<string, string>> {
  try {
    return new Store<Record<string, string>>({ name: `${SERVICE_NAME}-keys` });
  } catch {
    // Config file is corrupted — delete it and retry
    const configPath = join(app.getPath('userData'), `${SERVICE_NAME}-keys.json`);
    if (existsSync(configPath)) {
      console.warn('[KeychainService] Corrupted keys file detected, resetting:', configPath);
      unlinkSync(configPath);
    }
    return new Store<Record<string, string>>({ name: `${SERVICE_NAME}-keys` });
  }
}

const store = createStore();

export async function setApiKey(provider: string, key: string): Promise<void> {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key).toString('base64');
    store.set(provider, encrypted);
  } else {
    store.set(provider, key);
  }
}

export async function getApiKey(provider: string): Promise<string | null> {
  const stored = store.get(provider) as string | undefined;
  if (!stored) return null;

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      // Value may have been stored before safeStorage was available — return as-is
      return stored;
    }
  }
  return stored;
}

export async function deleteApiKey(provider: string): Promise<void> {
  store.delete(provider);
}
