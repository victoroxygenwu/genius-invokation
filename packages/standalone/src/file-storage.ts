/**
 * 持久化存储适配器集合
 *
 * - IndexedDBAdapter：基于 IndexedDB，最可靠，自动持久化
 * - FileAdapter：基于 File System Access API，写入用户指定文件
 * - TauriAdapter：预留 Tauri 后端接口
 */

import type { ConfigStorage } from "./configStore";
import type { SimpleStorage } from "@gi-tcg/roguelike";

// ============================================================
// IndexedDB 适配器（推荐默认使用）
// ============================================================

const IDB_DB_NAME = "gi-tcg-roguelike";
const IDB_STORE_NAME = "config";
const IDB_DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDBAdapter implements ConfigStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  /** 内存缓存：IDB 异步期间保证同步读取 */
  private cache = new Map<string, unknown>();

  constructor() {
    this.initPromise = openDB().then((db) => {
      this.db = db;
    }).catch((e) => {
      console.warn("[IndexedDBAdapter] open failed, falling back to memory", e);
    });
  }

  load<T>(key: string, fallback: T): T {
    // 先检查缓存
    if (this.cache.has(key)) return this.cache.get(key) as T;
    // 异步预热缓存（不阻塞）
    this.warmCache(key, fallback);
    return fallback;
  }

  save(key: string, data: unknown): void {
    this.cache.set(key, data);
    this.writeToIDB(key, data);
  }

  private async warmCache(key: string, fallback: unknown): Promise<void> {
    await this.initPromise;
    if (!this.db) return;
    try {
      const raw = await idbGet(this.db, key);
      if (raw !== null) {
        this.cache.set(key, JSON.parse(raw));
      }
    } catch { /* ignore */ }
  }

  private async writeToIDB(key: string, data: unknown): Promise<void> {
    await this.initPromise;
    if (!this.db) return;
    try {
      await idbSet(this.db, key, JSON.stringify(data));
    } catch (e) {
      console.warn("[IndexedDBAdapter] save failed", e);
    }
  }

  /** 等待 IDB 初始化完成后，从缓存返回值（用于首次加载场景） */
  async ready<T>(key: string, fallback: T): Promise<T> {
    await this.initPromise;
    if (!this.db) return fallback;
    try {
      const raw = await idbGet(this.db, key);
      if (raw !== null) {
        const val = JSON.parse(raw) as T;
        this.cache.set(key, val);
        return val;
      }
    } catch { /* ignore */ }
    return fallback;
  }
}

// ============================================================
// File System Access API 适配器
// ============================================================

const FILE_HANDLE_IDB_KEY = "gi-tcg-file-handle";

export class FileAdapter implements ConfigStorage {
  private handle: FileSystemFileHandle | null = null;
  private cache = new Map<string, unknown>();
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.restoreHandle();
  }

  /** 从 IndexedDB 恢复文件句柄 */
  private async restoreHandle(): Promise<void> {
    try {
      const db = await openDB();
      const raw = await idbGet(db, FILE_HANDLE_IDB_KEY);
      if (raw) {
        const handle = JSON.parse(raw) as any as FileSystemFileHandle;
        // 验证权限
        const qperm = (handle as any).queryPermission?.bind(handle);
        if (qperm) {
          const perm = await qperm({ mode: "readwrite" });
          if (perm === "granted") {
            this.handle = handle;
            await this.loadFromFile();
          }
        } else {
          // queryPermission 不可用时直接尝试读取
          this.handle = handle;
          await this.loadFromFile();
        }
      }
    } catch { /* ignore */ }
  }

  /** 弹出文件选择器，获取句柄 */
  async pickFile(): Promise<boolean> {
    if (!("showSaveFilePicker" in window)) return false;
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: "roguelike-save.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      this.handle = handle;
      // 保存句柄到 IndexedDB
      const db = await openDB();
      await idbSet(db, FILE_HANDLE_IDB_KEY, JSON.stringify(handle));
      // 写入当前缓存
      await this.saveToFile();
      return true;
    } catch { return false; }
  }

  load<T>(key: string, fallback: T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    // 异步加载
    this.initPromise.then(() => this.loadFromFile());
    return fallback;
  }

  save(key: string, data: unknown): void {
    this.cache.set(key, data);
    this.initPromise.then(() => this.saveToFile());
  }

  private async loadFromFile(): Promise<void> {
    if (!this.handle) return;
    try {
      const file = await this.handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      if (typeof data === "object" && data !== null) {
        for (const [k, v] of Object.entries(data)) {
          this.cache.set(k, v);
        }
      }
    } catch { /* ignore */ }
  }

  private async saveToFile(): Promise<void> {
    if (!this.handle) return;
    try {
      const qperm = (this.handle as any).queryPermission?.bind(this.handle);
      if (qperm) {
        const perm = await qperm({ mode: "readwrite" });
        if (perm !== "granted") return;
      }
      const writable = await this.handle.createWritable();
      const obj: Record<string, unknown> = {};
      for (const [k, v] of this.cache) obj[k] = v;
      await writable.write(JSON.stringify(obj, null, 2));
      await writable.close();
    } catch (e) {
      console.warn("[FileAdapter] save failed", e);
    }
  }

  get hasFile(): boolean { return this.handle !== null; }
}

// ============================================================
// Tauri 适配器（预留）
// ============================================================

/**
 * Tauri 后端适配器。
 * 打包后通过 invoke 调用 Rust 命令读写 ~/.gi-tcg-roguelike/save.json
 *
 * Rust 端示例：
 * ```rust
 * #[tauri::command]
 * fn load_config(key: String) -> Result<String, String> { ... }
 * #[tauri::command]
 * fn save_config(key: String, data: String) -> Result<(), String> { ... }
 * ```
 */
export class TauriAdapter implements ConfigStorage {
  private invoke: ((cmd: string, args: any) => Promise<any>) | null = null;
  private cache = new Map<string, unknown>();
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      // 动态导入 Tauri API（编译时不存在不影响）
      const mod = await (Function('return import("@tauri-apps/api/core")')() as Promise<any>);
      this.invoke = mod.invoke;
      await this.loadAll();
    } catch { /* not in Tauri */ }
  }

  private async loadAll(): Promise<void> {
    if (!this.invoke) return;
    try {
      const raw = await this.invoke("load_config", {});
      if (raw && typeof raw === "string") {
        const data = JSON.parse(raw);
        for (const [k, v] of Object.entries(data)) {
          this.cache.set(k, v);
        }
      }
    } catch { /* ignore */ }
  }

  load<T>(key: string, fallback: T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    this.initPromise.then(() => { /* cache warmed, but signals won't re-read */ });
    return fallback;
  }

  /** 等待初始化完成后从缓存返回值 */
  async ready<T>(key: string, fallback: T): Promise<T> {
    await this.initPromise;
    return (this.cache.get(key) as T) ?? fallback;
  }

  save(key: string, data: unknown): void {
    this.cache.set(key, data);
    this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.invoke) return;
    try {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of this.cache) obj[k] = v;
      await this.invoke("save_config", { data: JSON.stringify(obj, null, 2) });
    } catch (e) {
      console.warn("[TauriAdapter] save failed", e);
    }
  }

  get available(): boolean { return this.invoke !== null; }
}

// ============================================================
// SimpleStorage 适配器（用于 RoguelikeRunManager 存档）
// ============================================================

/**
 * 将 IndexedDBAdapter 包装为 SimpleStorage 接口。
 * 所有方法返回 Promise，兼容异步存储。
 */
export class SimpleStorageAdapter implements SimpleStorage {
  private db: IDBDatabase | null = null;
  private cache = new Map<string, string | null>();
  private initPromise: Promise<void>;
  private storeName: string;

  constructor(storeName = "saves") {
    this.storeName = storeName;
    this.initPromise = openDB().then((db) => {
      this.db = db;
    }).catch((e) => {
      console.warn("[SimpleStorageAdapter] open failed", e);
    });
  }

  async getItem(key: string): Promise<string | null> {
    await this.initPromise;
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (!this.db) return null;
    try {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      return new Promise((resolve) => {
        req.onsuccess = () => {
          const val = req.result ?? null;
          this.cache.set(key, val);
          resolve(val);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  async setItem(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
    await this.initPromise;
    if (!this.db) return;
    try {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put(value, key);
    } catch { /* ignore */ }
  }

  async removeItem(key: string): Promise<void> {
    this.cache.delete(key);
    await this.initPromise;
    if (!this.db) return;
    try {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      store.delete(key);
    } catch { /* ignore */ }
  }
}

// ============================================================
// 自动选择最佳适配器
// ============================================================

/**
 * 检测环境并创建最佳存储适配器。
 * 优先级：Tauri > File System Access API > IndexedDB > localStorage（回退）
 */
export function createBestStorage(): ConfigStorage {
  // 检测 Tauri
  if ("__TAURI_INTERNALS__" in window) {
    return new TauriAdapter();
  }
  // 检测 File System Access API
  if ("showSaveFilePicker" in window) {
    return new FileAdapter();
  }
  // IndexedDB
  if ("indexedDB" in window) {
    return new IndexedDBAdapter();
  }
  // 回退到 localStorage（由 configStore 默认处理）
  throw new Error("No persistent storage available");
}
