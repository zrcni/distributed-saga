import { uuid } from "@/utils"
import { Queue } from "./Queue"

interface IChannelItem<T = unknown> {
  id: string
  data: T
}

export class ChannelItem<T = unknown> {
  id: string
  data: T

  constructor(id: string, data: T) {
    this.id = id
    this.data = data
  }

  toJSON(): IChannelItem<T> {
    return {
      id: this.id,
      data: this.data,
    }
  }
}

type SubscribeCallback<T = unknown> = (data: T) => any | Promise<any>
type UnsubscribeCallback = () => void

export interface ChannelPublisher {
  publish<T = unknown>(data: T): void
}

export interface ChannelSubscriber {
  subscribe<T = unknown>(
    callback: SubscribeCallback<T>
  ): UnsubscribeCallback | Promise<UnsubscribeCallback>
}

/**
 * One channel with multiple possible subscribers
 * Each subscriber gets the message
 */
export class Channel implements ChannelPublisher, ChannelSubscriber {
  private queue: Queue<IChannelItem<any>>
  private executing: boolean
  private callbacks: Set<SubscribeCallback<any>>

  constructor(queue: Queue<IChannelItem<any>>) {
    this.queue = queue
    this.executing = false
    this.callbacks = new Set()
  }

  publish<T = unknown>(data: T) {
    this.queue.put(new ChannelItem(uuid(), data).toJSON())
    setImmediate(() => this.tryProcessQueue())
  }

  subscribe<T = unknown>(callback: SubscribeCallback<T>) {
    this.callbacks.add(callback)
    return function unsubscribe() {
      this.callbacks.remove(callback)
    }
  }

  private tryProcessQueue() {
    if (this.executing || this.queue.size() === 0) return
    return this.processQueue()
  }

  private processQueue() {
    const item = this.queue.take()
    if (!item) return

    this.executing = true

    for (const callback of this.callbacks) {
      setImmediate(() => this.processItem(item, callback))
    }

    this.executing = false

    return setImmediate(() => this.tryProcessQueue())
  }

  private async processItem(item: IChannelItem, callback: SubscribeCallback) {
    try {
      await callback(item.data)
      // eslint-disable-next-line no-empty
    } catch (err) {}
  }
}
