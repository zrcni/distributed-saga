import { Channel } from "./Channel"
import { Queue } from "./Queue"

export const sagaInChannel = new Channel(new Queue())
