# Uniswap AI Overview (/docs/uniswap-ai/overview)

Get started with Uniswap AI plugins, skills, and LLM context.

Use Uniswap AI to speed up swap integration, hook development, and EVM workflows with tools designed for builders on Uniswap.

Uniswap AI [#uniswap-ai]

The [Uniswap AI repository](https://github.com/Uniswap/uniswap-ai) is an open-source collection of plugins and skills for coding agents. It provides protocol-specific guidance for Uniswap APIs and smart contracts.

Available plugins [#available-plugins]

| Plugin              | Description                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **uniswap-trading** | Integrate swaps via the [Uniswap API](https://developers.uniswap.org/dashboard), Universal Router SDK, or direct contract calls. |
| **uniswap-hooks**   | Security-first guidance for building Uniswap v4 hooks.                                                                           |
| **uniswap-viem**    | EVM integration with viem and wagmi.                                                                                             |
| **uniswap-driver**  | Token discovery and swap/liquidity planning with deep links.                                                                     |
| **uniswap-cca**     | Configure and deploy CCA contracts for token distribution.                                                                       |

Official skills [#official-skills]

These are the official skills currently published in Uniswap AI:

* `configurator`
* `deployer`
* `liquidity-planner`
* `pay-with-any-token`
* `swap-integration`
* `swap-planner`
* `v4-security-foundations`
* `viem-integration`

Install Uniswap AI [#install-uniswap-ai]

Skills CLI (any agent) [#skills-cli-any-agent]

```bash
npx skills add Uniswap/uniswap-ai
```

Claude Code marketplace [#claude-code-marketplace]

If you use [Claude Code](https://claude.ai/code), add the marketplace and install plugins:

```bash
# Add the Uniswap marketplace
/plugin marketplace add uniswap/uniswap-ai

# Install individual plugins
/plugin install uniswap-hooks      # v4 hook development
/plugin install uniswap-trading    # Swap integration (+ pay-with-any-token skill)
/plugin install uniswap-viem       # EVM / viem / wagmi
/plugin install uniswap-driver     # Token discovery & deep links
/plugin install uniswap-cca        # CCA auction configuration
```

Once installed, the plugins activate automatically when relevant to your task. You can also invoke specific skills directly, for example, `/uniswap-hooks:v4-security-foundations` for a security-first walkthrough of hook development.

LLM Context Files [#llm-context-files]

If you prefer to give your AI agent raw documentation context rather than structured skills, Uniswap publishes LLM-optimized text files that summarize the protocol documentation.

llms.txt and llms-full.txt [#llmstxt-and-llms-fulltxt]

AI models have a context window, which is the amount of text they can process at once. Providing relevant documentation upfront helps the model give better answers without hallucinating.

Uniswap offers two context files:

* <a href="/docs/uniswap-ai/llms.txt" target="_blank">**llms.txt**</a>: A compact summary with links to documentation sections. Works well with most models (100K+ token context windows).
* <a href="/docs/uniswap-ai/v4-llms.txt" target="_blank">**v4-llms.txt**</a>: A verbose version with more inline content. Use this if your model has a larger context window or you want more detail without following links.

Code Editor Setup [#code-editor-setup]

Cursor [#cursor]

1. Navigate to **Cursor Settings > Features > Docs**
2. Select **Add new doc** and paste one of the following URLs:

```
https://developers.uniswap.org/docs/uniswap-ai/llms.txt
```

```
https://developers.uniswap.org/docs/uniswap-ai/v4-llms.txt
```

3. Use `@docs` → **Uniswap** to reference the documentation in your chat.

Claude Code [#claude-code]

Install the Uniswap AI plugins (see [above](#install-as-a-claude-code-plugin)) for the richest integration. The plugins provide structured skills, expert agents, and protocol-specific tools that go beyond static documentation context.

Where to Go Next [#where-to-go-next]

* [Browse official skills](/docs/uniswap-ai/skills)
* [Contribute to Uniswap AI](/docs/uniswap-ai/contributions)
* [View the Uniswap AI repository](https://github.com/Uniswap/uniswap-ai)

Legal Disclaimer [#legal-disclaimer]

See the [Usage Guidelines](https://github.com/Uniswap/uniswap-ai/blob/main/DISCLAIMER.md) for important information about intended use and financial information disclaimers.
