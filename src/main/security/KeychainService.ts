/**
 * KeychainService - Manages API key storage.
 *
 * In production, this would use `keytar` to store keys in the OS keychain.
 * For now, uses electron-store as a fallback that works cross-platform
 * without native compilation issues.
 */
import Store from 'electron-store';

const SERVICE_NAME = 'termimate';

const store = new Store<Record<string, string>>({
  name: `${SERVICE_NAME}-keys`,
  encryptionKey: SERVICE_NAME,
});

export async function setApiKey(provider: string, key: string): Promise<void> {
  store.set(provider, key);
}

export async function getApiKey(provider: string): Promise<string | null> {
  return (store.get(provider) as string) ?? null;
}

export async function deleteApiKey(provider: string): Promise<void> {
  store.delete(provider);
}
