import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js"

type TransportDelegate = {
  start(): Promise<void>
  send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void>
  close(): Promise<void>
  onclose?: (() => void) | undefined
  onerror?: ((error: Error) => void) | undefined
  onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined
  setProtocolVersion?: ((version: string) => void) | undefined
}

export class ExactOptionalTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void

  constructor(private readonly delegate: TransportDelegate) {}

  async start(): Promise<void> {
    this.installCallbacks()
    await this.delegate.start()
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    await this.delegate.send(message, options)
  }

  async close(): Promise<void> {
    await this.delegate.close()
  }

  setProtocolVersion(version: string): void {
    this.delegate.setProtocolVersion?.(version)
  }

  private installCallbacks(): void {
    if (this.onclose === undefined) {
      delete this.delegate.onclose
    } else {
      this.delegate.onclose = this.onclose
    }

    if (this.onerror === undefined) {
      delete this.delegate.onerror
    } else {
      this.delegate.onerror = this.onerror
    }

    if (this.onmessage === undefined) {
      delete this.delegate.onmessage
    } else {
      this.delegate.onmessage = this.onmessage
    }
  }
}
