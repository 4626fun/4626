# TOOLS.md

4626-specific notes for this Pinata agent instance.

- Agent ID: `xpm64dc3`
- Gateway base: `https://xpm64dc3.agents.pinata.cloud`
- Server env (Vercel): `AKITAI_PINATA_CHAT_ENDPOINT`, `AKITAI_PINATA_BEARER_TOKEN`
- In-container secrets: `OPENAI_API_KEY` (required), optional `PINATA_JWT`, optional `PRIVATE_KEY`
- `PRIVATE_KEY` = operator EOA `0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9` (Hermit/arena operator wallet — **not** canonical CSW XMTP identity)
- No AlfaClub / Hermit4626 bridge secrets on this agent
