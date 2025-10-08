import { logger } from "@/logger"
import { ChannelItem } from "./Channel"

type ChannelMessage<T = unknown> = {
  payload: T
}

export abstract class ChannelMessageHandler {
  abstract handle(msg: any): void | Promise<void>

  public async handleMessage<Payload = unknown>(item: ChannelItem<Payload>) {
    try {
      await this.handle(item.data)
    } catch (err) {
      logger.error(`Failed to handle channel message id ${item.id}: `, err)
    }
  }
}
