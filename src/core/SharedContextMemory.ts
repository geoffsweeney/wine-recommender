/**
 * Shared Context Memory System
 * Uses WeakMap for automatic garbage collection of unused contexts
 */
export class SharedContextMemory {
  private contexts: WeakMap<object, Map<string, ContextEntry>>;
  private versionHistory: Map<string, ContextVersion[]>;

  constructor() {
    this.contexts = new WeakMap();
    this.versionHistory = new Map();
  }

  /**
   * Stores context for a given agent/entity
   */
  setContext(owner: object, key: string, value: unknown, metadata?: ContextMetadata): void {
    if (!this.contexts.has(owner)) {
      this.contexts.set(owner, new Map());
    }

    const ownerContexts = this.contexts.get(owner)!;
    const timestamp = Date.now();
    const versionHash = this.generateVersionHash(value);

    ownerContexts.set(key, {
      value,
      metadata: metadata || {},
      timestamp,
      versionHash
    });

    this.recordVersion(key, { value, timestamp, versionHash });
  }

  /**
   * Retrieves context for a given agent/entity
   */
  getContext(owner: object, key: string): ContextEntry | undefined {
    return this.contexts.get(owner)?.get(key);
  }

  /**
   * Gets version history for a context key
   */
  getVersionHistory(key: string): ContextVersion[] {
    return this.versionHistory.get(key) || [];
  }

  private generateVersionHash(value: unknown): string {
    const str = typeof value === 'object' 
      ? JSON.stringify(value) 
      : String(value);
    return Buffer.from(str).toString('base64').slice(0, 16);
  }

  private recordVersion(key: string, version: ContextVersion): void {
    if (!this.versionHistory.has(key)) {
      this.versionHistory.set(key, []);
    }
    this.versionHistory.get(key)!.push(version);
  }
}

interface ContextEntry {
  value: unknown;
  metadata: ContextMetadata;
  timestamp: number;
  versionHash: string;
}

interface ContextVersion {
  value: unknown;
  timestamp: number;
  versionHash: string;
}

interface ContextMetadata {
  source?: string;
  confidence?: number;
  expiresAt?: number;
}