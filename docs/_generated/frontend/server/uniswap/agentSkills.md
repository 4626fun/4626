[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/uniswap/agentSkills

# server/uniswap/agentSkills

## Type Aliases

### UniswapSkillName

> **UniswapSkillName** = `"uniswap_quote"` \| `"uniswap_check_approval"` \| `"uniswap_build_swap"` \| `"uniswap_batch_swap_5792"` \| `"uniswap_delegated_swap_7702"` \| `"uniswap_crosschain_plan"` \| `"uniswap_liquidity"`

Defined in: [server/uniswap/agentSkills.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/uniswap/agentSkills.ts#L4)

## Functions

### executeUniswapSkill()

> **executeUniswapSkill**(`name`, `payload`): `Promise`\<\{ `data`: `unknown`; `requestId`: `string`; \}\>

Defined in: [server/uniswap/agentSkills.ts:75](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/uniswap/agentSkills.ts#L75)

#### Parameters

##### name

[`UniswapSkillName`](#uniswapskillname)

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<\{ `data`: `unknown`; `requestId`: `string`; \}\>
