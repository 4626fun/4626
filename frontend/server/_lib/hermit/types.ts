export type HermitMeme = {
  id: string
  url: string
  caption: string
  tags: string[]
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
  provider: 'local' | 'pinata'
}
