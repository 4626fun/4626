Coins Metadata

Coins follow the ERC-7572 metadata standard for fungible tokens.

Related:

- `docs/token-image.md` — Uniswap Token Lists logoURI + SVG/PNG ingestion requirements for our generated token images.

This is conceptually based on the same JSON conventions as NFT metadata (name/description/image) but adapted for coin metadata and Zora-compatible clients.

The metadata URI is specified during coin deployment and can be updated by coin owners after deployment.

This guide includes a recommended JSON shape and how to validate it with the `@zoralabs/coins-sdk` validator utilities.

## Metadata JSON Format

Your metadata JSON file should follow this format:

```json
{
  "name": "horse",
  "description": "boundless energy",
  "image": "ipfs://bafkreifch6stfh3fn3nqv5tpxnknjpo7zulqav55f2b5pryadx6hldldwe",
  "properties": {
    "category": "social"
  }
}
```

Optionally, for non-image assets, the `animation_url` property can be used to link an audio or video file preferably on IPFS.

For better indexing consistency, the optional `content` extension is supported by Zora tooling. It is recommended instead of relying on OpenSea-specific fields.

Example:

```json
{
  "name": "boundless horse",
  "description": "boundless horse",
  "image": "ipfs://bafkreifch6stfh3fn3nqv5tpxnknjpo7zulqav55f2b5pryadx6hldldwe",
  "animation_url": "ipfs://bafybeiatmngyt4wwu6mla27523qk33klxopycomegris3n25y6rcqs27c4",
  "content": {
    "mime": "video/mp4",
    "uri": "ipfs://bafybeiatmngyt4wwu6mla27523qk33klxopycomegris3n25y6rcqs27c4"
  },
  "properties": {
    "category": "social"
  }
}
```

### Notes for 4626 ShareOFT metadata

When we generate ERC-7572 metadata for ShareOFT tokens, we include these keys:
- `name`, `description`, `image`
- `animation_url` (SVG variant)
- `properties.category` (plus additional properties for UI context)

## Metadata JSON Validator

We have a validator (from `@zoralabs/coins-sdk`) that can be used to check your metadata JSON and/or the resolved metadata content at a URI.

### validateMetadataJSON

Validates metadata JSON content (throws if invalid).

```ts
import { validateMetadataJSON } from '@zoralabs/coins-sdk'

validateMetadataJSON({
  name: 'horse',
  description: 'boundless energy',
  image: 'ipfs://bafkreifch6stfh3fn3nqv5tpxnknjpo7zulqav55f2b5pryadx6hldldwe',
  properties: { category: 'social' }
})
```

This will throw if the metadata is invalid:

```ts
validateMetadataJSON({
  name: 'horse',
  description: 'boundless energy',
  image: 123,
  foo: 'bar'
})
```

### validateMetadataURIContent

Validates metadata fetched from a URI (throws if invalid).

```ts
import { validateMetadataURIContent } from '@zoralabs/coins-sdk'

await validateMetadataURIContent('https://theme.wtf/metadata/metadata.json')
await validateMetadataURIContent('ipfs://bafybeigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguysy')
```

This will throw on invalid URIs/schemes:

```ts
await validateMetadataURIContent('data:foo')
```

This will succeed for valid JSON content behind the URI:

```ts
await validateMetadataURIContent('data:application/json;base64,eyJuYW1lIjoiaG9yc2UifQ==')
```

