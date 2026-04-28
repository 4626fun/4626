export type HermitMeme = {
  id: string
  url: string
  caption: string
  tags: string[]
}

export type HermitMediaAttachment = {
  url: string
  type: string
  filename?: string
  mime_type?: string
}

export type HermitCommandKind = 'gmeow' | 'hermit' | 'meme'

export type HermitExecutionParams = {
  commandText: string
  senderAddress: `0x${string}`
}

export type HermitExecutionResult = {
  kind: HermitCommandKind
  reply: string
  meme?: HermitMeme
  imagePrompt?: string
  mediaAttachments?: HermitMediaAttachment[]
  provider: 'local' | 'pinata'
}
