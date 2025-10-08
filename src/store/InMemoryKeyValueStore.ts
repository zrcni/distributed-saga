import { KeyValueStore } from "./types"

export class InMemoryKeyValueStore<T = unknown> implements KeyValueStore<T> {
  private data: Record<string, any>

  constructor() {
    this.data = {}
  }

  async get(key: string): Promise<T | null> {
    if (key in this.data) {
      return this.data[key]
    }
    return null
  }

  async getAll(): Promise<T[]> {
    return Object.values(this.data)
  }

  async set(key: string, value: T): Promise<T> {
    this.data[key] = value
    return this.data[key]
  }

  async remove(key: string): Promise<boolean> {
    if (key in this.data) {
      delete this.data[key]
      return true
    }
    return false
  }
}
