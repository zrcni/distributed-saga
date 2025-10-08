export class Queue<T = unknown> {
  private items: T[] = []

  put(item: T) {
    this.items.push(item)
  }

  take() {
    if (this.items.length === 0) return null
    return this.items.shift()
  }

  size() {
    return this.items.length
  }
}
