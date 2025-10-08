export interface KeyValueStore<T = unknown> {
  get(key: string): Promise<T | null>
  getAll(): Promise<T[]>
  set(key: string, value: T): Promise<T>
  remove(key: string): Promise<boolean>
}
