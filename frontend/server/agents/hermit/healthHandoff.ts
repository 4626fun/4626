import type { Server } from 'node:http'

let earlyHealthServer: Server | null = null

export function registerEarlyHealthServer(server: Server): void {
  earlyHealthServer = server
}

export async function closeEarlyHealthServer(): Promise<void> {
  const server = earlyHealthServer
  earlyHealthServer = null
  if (!server) return
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
