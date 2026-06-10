# 4626 Action Matrix by Role

Generated from `docs/operations/action-matrix.csv`.

## user_ui


| Action                       | Endpoint / Method             | Permission       | Mode   | Notes                         | Source                 |
| ---------------------------- | ----------------------------- | ---------------- | ------ | ----------------------------- | ---------------------- |
| `open_swap`                  | `/swap`                       | session+accepted | manual | Primary trading surface       | `frontend/src/App.tsx` |
| `open_portfolio`             | `/portfolio`                  | session+accepted | manual | Portfolio and AMOE card       | `frontend/src/App.tsx` |
| `open_positions`             | `/positions`                  | session+accepted | manual | Positions view                | `frontend/src/App.tsx` |
| `open_deploy`                | `/deploy`                     | session+accepted | manual | Creator vault deployment flow | `frontend/src/App.tsx` |
| `open_coin_manage`           | `/coin/:address/manage`       | session+accepted | manual | Creator coin management       | `frontend/src/App.tsx` |
| `open_creator_earnings`      | `/creator/earnings`           | session+accepted | manual | Creator earnings view         | `frontend/src/App.tsx` |
| `open_vote`                  | `/vote`                       | session+accepted | manual | Gauge voting page             | `frontend/src/App.tsx` |
| `open_auction_bid`           | `/auction/bid/:address`       | session+accepted | manual | CCA bidding UX                | `frontend/src/App.tsx` |
| `open_complete_auction`      | `/complete-auction/:strategy` | session+accepted | manual | Post-graduation completion UX | `frontend/src/App.tsx` |
| `open_vault`                 | `/vault/:address`             | session+accepted | manual | Vault detail page             | `frontend/src/App.tsx` |
| `open_agent_directory`       | `/agents`                     | session+accepted | manual | Agent directory               | `frontend/src/App.tsx` |
| `open_agent_register`        | `/agents/register`            | session+accepted | manual | Agent registration UX         | `frontend/src/App.tsx` |
| `open_agent_uri_service`     | `/agents/uri-service`         | session+accepted | manual | Agent URI service UX          | `frontend/src/App.tsx` |
| `open_explore_creators`      | `/explore/creators`           | session+accepted | manual | Creator discovery             | `frontend/src/App.tsx` |
| `open_explore_content`       | `/explore/content`            | session+accepted | manual | Content discovery             | `frontend/src/App.tsx` |
| `open_explore_trends`        | `/explore/trends`             | session+accepted | manual | Trends discovery              | `frontend/src/App.tsx` |
| `open_explore_transactions`  | `/explore/transactions`       | session+accepted | manual | Transactions discovery        | `frontend/src/App.tsx` |
| `open_accounts`              | `/accounts`                   | session          | manual | Account linking/settings      | `frontend/src/App.tsx` |
| `open_status`                | `/status`                     | marketing host   | manual | Protocol status page          | `frontend/src/App.tsx` |
| `open_leaderboard`           | `/leaderboard`                | public route     | manual | Leaderboard page              | `frontend/src/App.tsx` |
| `open_faq`                   | `/faq`                        | marketing host   | manual | FAQ                           | `frontend/src/App.tsx` |
| `open_distribute_cca_launch` | `/distribute/cca-launch`      | marketing host   | manual | Distribution info             | `frontend/src/App.tsx` |


## user_amoe


| Action                       | Endpoint / Method                              | Permission                      | Mode          | Notes                                  | Source                                                     |
| ---------------------------- | ---------------------------------------------- | ------------------------------- | ------------- | -------------------------------------- | ---------------------------------------------------------- |
| `read_credits`               | `GET /api/v1/lottery/amoe/credits`             | wallet authority check          | manual        | Reads AMOE credit snapshot             | `frontend/api/_handlers/v1/lottery/_amoeCredits.ts`        |
| `claim_daily_twitter_credit` | `POST /api/v1/lottery/amoe/twitter-checkin`    | auth + rate limited             | manual        | Awards +1 daily credit                 | `frontend/api/_handlers/v1/lottery/_amoeTwitterCheckin.ts` |
| `issue_nonce`                | `GET /api/v1/lottery/amoe/nonce`               | wallet authority + rate limited | manual        | Issues nonce and signable challenge    | `frontend/api/_handlers/v1/lottery/_amoeNonce.ts`          |
| `sign_challenge`             | `walletClient.signMessage(message)`            | wallet signature                | manual        | User signs AMOE challenge              | `frontend/src/components/lottery/AmoeEntryCard.tsx`        |
| `submit_amoe_proof`          | `POST /api/v1/lottery/amoe/submit`             | proof verification + rate limit | manual/hybrid | Returns calldata or relays transaction | `frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`         |
| `relay_amoe_tx`              | `relayAmoeEntryTransaction(to,callData)`       | relay keys configured           | automated     | Server-submitted AMOE tx path          | `frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`         |
| `client_send_amoe_tx`        | `walletClient.sendTransaction(to,callData)`    | wallet tx approval              | manual        | Client-submitted AMOE tx path          | `frontend/src/components/lottery/AmoeEntryCard.tsx`        |
| `wait_for_amoe_receipt`      | `publicClient.waitForTransactionReceipt(hash)` | n/a                             | manual        | Confirms onchain AMOE entry            | `frontend/src/components/lottery/AmoeEntryCard.tsx`        |
| `consume_amoe_credits`       | `consumeAmoeCreditsForEntry(wallet)`           | sufficient credits              | automated     | Debits credits per entry               | `frontend/server/_lib/lotteryAmoe.ts`                      |


## user_api_read


| Action                     | Endpoint / Method                           | Permission | Mode   | Notes                       | Source                                 |
| -------------------------- | ------------------------------------------- | ---------- | ------ | --------------------------- | -------------------------------------- |
| `read_lottery_global`      | `GET /api/v1/lottery/global`                | read       | manual | Global lottery stats/config | `frontend/api/_handlers/_routes.v1.ts` |
| `read_lottery_creator`     | `GET /api/v1/lottery/creator/{creatorCoin}` | read       | manual | Per-creator lottery stats   | `frontend/api/_handlers/_routes.v1.ts` |
| `read_recent_winners`      | `GET /api/v1/lottery/recentWinners`         | read       | manual | Recent lottery winners      | `frontend/api/_handlers/_routes.v1.ts` |
| `read_vault_report`        | `GET /api/v1/vault/{address}/report`        | read       | manual | Vault report payload        | `frontend/api/_handlers/_routes.v1.ts` |
| `read_vault_strategies`    | `GET /api/v1/vault/{address}/strategies`    | read       | manual | Vault strategy payload      | `frontend/api/_handlers/_routes.v1.ts` |
| `read_auction_status`      | `GET /api/v1/auction/{address}/status`      | read       | manual | Auction status              | `frontend/api/_handlers/_routes.v1.ts` |
| `read_auction_activity`    | `GET /api/v1/auction/{address}/activity`    | read       | manual | Auction live activity       | `frontend/api/_handlers/_routes.v1.ts` |
| `read_auction_recent_bids` | `GET /api/v1/auction/{address}/recentBids`  | read       | manual | Recent bids                 | `frontend/api/_handlers/_routes.v1.ts` |
| `read_gauge_epoch`         | `GET /api/v1/gauge/epoch`                   | read       | manual | Gauge epoch state           | `frontend/api/_handlers/_routes.v1.ts` |
| `read_gauge_vaults`        | `GET /api/v1/gauge/vaults`                  | read       | manual | Gauge vault weights         | `frontend/api/_handlers/_routes.v1.ts` |
| `read_gauge_user_votes`    | `GET /api/v1/gauge/user/{address}`          | read       | manual | User vote distribution      | `frontend/api/_handlers/_routes.v1.ts` |
| `read_ve4626_user`         | `GET /api/v1/ve4626/user/{address}`         | read       | manual | ve4626 lock/power           | `frontend/api/_handlers/_routes.v1.ts` |
| `read_charm_strategy`      | `GET /api/v1/charm/strategy/{address}`      | read       | manual | Charm strategy status       | `frontend/api/_handlers/_routes.v1.ts` |
| `read_openapi_spec`        | `GET /api/v1/spec.json`                     | read       | manual | Agent-facing API spec       | `frontend/api/_handlers/v1/_spec.ts`   |


## user_api_build


| Action                                            | Endpoint / Method                                          | Permission                | Mode   | Notes               | Source                                 |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------------------- | ------ | ------------------- | -------------------------------------- |
| `build_submit_bid`                                | `POST /api/v1/build/auction/submitBid`                     | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_gauge_vote`                                | `POST /api/v1/build/gauge/vote`                            | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_gauge_reset_votes`                         | `POST /api/v1/build/gauge/resetVotes`                      | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ve_lock`                                   | `POST /api/v1/build/ve4626/lock`                           | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ve_extend`                                 | `POST /api/v1/build/ve4626/extend`                         | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ve_increase`                               | `POST /api/v1/build/ve4626/increase`                       | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ve_unlock`                                 | `POST /api/v1/build/ve4626/unlock`                         | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_borrow`                               | `POST /api/v1/build/ajna/borrow`                           | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_repay`                                | `POST /api/v1/build/ajna/repay`                            | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_add_collateral`                       | `POST /api/v1/build/ajna/addCollateral`                    | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_remove_collateral`                    | `POST /api/v1/build/ajna/removeCollateral`                 | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_set_min_bucket`                       | `POST /api/v1/build/ajna/setMinBucketIndex`                | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_ajna_set_idle_buffer`                      | `POST /api/v1/build/ajna/setIdleBufferBps`                 | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_charm_vault`                     | `POST /api/v1/build/charm/setCharmVault`                   | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_swap_pool`                       | `POST /api/v1/build/charm/setSwapPool`                     | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_uni_factory`                     | `POST /api/v1/build/charm/setUniFactory`                   | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_auto_fee_tier`                   | `POST /api/v1/build/charm/setAutoFeeTier`                  | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_parameters`                      | `POST /api/v1/build/charm/setParameters`                   | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_set_active`                          | `POST /api/v1/build/charm/setActive`                       | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_initialize_approvals`                | `POST /api/v1/build/charm/initializeApprovals`             | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_rebalance`                           | `POST /api/v1/build/charm/rebalance`                       | caller signs tx           | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_owner_emergency_withdraw`            | `POST /api/v1/build/charm/ownerEmergencyWithdraw`          | owner role expected       | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_owner_emergency_withdraw_from_charm` | `POST /api/v1/build/charm/ownerEmergencyWithdrawFromCharm` | owner role expected       | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_vault_rebalance`                     | `POST /api/v1/build/charm/vault/rebalance`                 | manager/delegate expected | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |
| `build_charm_vault_set_strategy`                  | `POST /api/v1/build/charm/vault/setStrategy`               | manager/owner expected    | manual | Build-only calldata | `frontend/api/_handlers/_routes.v1.ts` |


## group_access


| Action                       | Endpoint / Method                          | Permission        | Mode          | Notes                                    | Source                                    |
| ---------------------------- | ------------------------------------------ | ----------------- | ------------- | ---------------------------------------- | ----------------------------------------- |
| `request_access_proof`       | `POST /api/v1/agents/access-proof/request` | authenticated     | manual        | Generates signable room proof payload    | `frontend/api/_handlers/_routes.v1.ts`    |
| `verify_access_proof`        | `POST /api/v1/agents/access-proof/verify`  | signed proof      | manual        | Issues short-lived room token            | `frontend/api/_handlers/_routes.v1.ts`    |
| `xmtp_join_instructions`     | `POST /api/v1/agents/xmtp/join`            | valid room token  | manual        | XMTP join instructions                   | `frontend/api/_handlers/_routes.v1.ts`    |
| `telegram_join_instructions` | `POST /api/v1/agents/telegram/join`        | valid room token  | manual        | Telegram join instructions               | `frontend/api/_handlers/_routes.v1.ts`    |
| `keepr_join`                 | `POST /api/keepr/join`                     | signed join proof | manual/hybrid | Checks gating and may enqueue add_member | `frontend/api/_handlers/keepr/_join.ts`   |
| `keepr_join_status`          | `GET /api/keepr/joinStatus`                | context dependent | manual        | Join request status                      | `frontend/api/_handlers/_routes.keepr.ts` |
| `keepr_nonce`                | `GET /api/keepr/nonce`                     | context dependent | manual        | Join proof nonce                         | `frontend/api/_handlers/_routes.keepr.ts` |


## agent_command


| Action               | Endpoint / Method                          | Permission                     | Mode   | Notes                                      | Source                                       |
| -------------------- | ------------------------------------------ | ------------------------------ | ------ | ------------------------------------------ | -------------------------------------------- |
| `start`              | `/start`                                   | all users                      | manual | Open bot home                              | `frontend/server/commands/families/keepr.ts` |
| `help`               | `/help [topic]`                            | all users                      | manual | Command tree and topics                    | `frontend/server/commands/families/keepr.ts` |
| `link`               | `/link`                                    | all users                      | manual | Link Telegram to 4626 account              | `frontend/server/commands/families/keepr.ts` |
| `status`             | `/status`                                  | all users                      | manual | Link status                                | `frontend/server/commands/families/keepr.ts` |
| `id`                 | `/id`                                      | group                          | manual | Shows IDs                                  | `frontend/server/commands/families/keepr.ts` |
| `buy`                | `/buy`                                     | all users                      | manual | Guided buy                                 | `frontend/server/commands/families/keepr.ts` |
| `sell`               | `/sell`                                    | all users                      | manual | Guided sell                                | `frontend/server/commands/families/keepr.ts` |
| `bid`                | `/bid`                                     | all users                      | manual | Guided bid                                 | `frontend/server/commands/families/keepr.ts` |
| `vaults`             | `/vaults`                                  | all users                      | manual | Lists vaults                               | `frontend/server/commands/families/keepr.ts` |
| `auctions`           | `/auctions`                                | all users                      | manual | Lists auctions                             | `frontend/server/commands/families/keepr.ts` |
| `wallet`             | `/wallet`                                  | all users                      | manual | Wallet summary                             | `frontend/server/commands/families/keepr.ts` |
| `whois`              | `/whois <address>`                         | all users                      | manual | ENS/Basename identity lookup               | `frontend/server/commands/families/keepr.ts` |
| `intel`              | `/intel <address>`                         | all users                      | manual | Wallet intelligence report                 | `frontend/server/commands/families/keepr.ts` |
| `reputation`         | `/reputation [agentId]`                    | all users                      | manual | Reputation graph                           | `frontend/server/commands/families/keepr.ts` |
| `feedback`           | `/feedback [agentId]`                      | all users                      | manual | Feedback summary                           | `frontend/server/commands/families/keepr.ts` |
| `send_usdc`          | `/send <amount> USDC to <address>`         | ADMIN/OWNER + configured vault | manual | Transfer command with rate limits and caps | `frontend/server/commands/families/keepr.ts` |
| `send_eth`           | `/send <amount> ETH to <address>`          | ADMIN/OWNER + configured vault | manual | Transfer command with rate limits and caps | `frontend/server/commands/families/keepr.ts` |
| `ai`                 | `/ai <question>`                           | all users                      | manual | Conversational command                     | `frontend/server/commands/families/keepr.ts` |
| `coin_trend_check`   | `/coin trend check <ticker>`               | all users                      | manual | Trend preflight                            | `frontend/server/commands/families/keepr.ts` |
| `coin_create`        | `/coin create <name> <symbol> <uri>`       | ADMIN + configured vault       | manual | Create content coin                        | `frontend/server/commands/families/keepr.ts` |
| `coin_buy`           | `/coin buy <address> <eth-amount>`         | configured vault               | manual | Buy coin                                   | `frontend/server/commands/families/keepr.ts` |
| `coin_sell`          | `/coin sell <address> <amount>`            | configured vault               | manual | Sell coin                                  | `frontend/server/commands/families/keepr.ts` |
| `coin_balance`       | `/coin balance`                            | configured vault               | manual | Agent wallet coin balances                 | `frontend/server/commands/families/keepr.ts` |
| `coin_info`          | `/coin info <address>`                     | configured vault               | manual | Coin details                               | `frontend/server/commands/families/keepr.ts` |
| `coin_trend_reserve` | `/coin trend reserve <ticker>`             | ADMIN + configured vault       | manual | Deploy trend coin                          | `frontend/server/commands/families/keepr.ts` |
| `coin_trend_status`  | `/coin trend status <ticker>`              | configured vault               | manual | Trend operation status                     | `frontend/server/commands/families/keepr.ts` |
| `coin_trend_funnel`  | `/coin trend funnel <ticker> <eth-amount>` | ADMIN + configured vault       | manual | Guarded trend action                       | `frontend/server/commands/families/keepr.ts` |
| `x_status`           | `/x status`                                | configured vault               | manual | Check X integration status                 | `frontend/server/commands/families/keepr.ts` |
| `x_post`             | `/x post <message> --confirm`              | ADMIN + configured vault       | manual | Post to X                                  | `frontend/server/commands/families/keepr.ts` |
| `keepr_status`       | `/keepr status`                            | group                          | manual | Vault runtime status                       | `frontend/server/commands/families/keepr.ts` |
| `keepr_rules`        | `/keepr rules`                             | group                          | manual | Gating and join rules                      | `frontend/server/commands/families/keepr.ts` |
| `keepr_check`        | `/keepr check [wallet]`                    | group                          | manual | Eligibility checks                         | `frontend/server/commands/families/keepr.ts` |
| `keepr_lock`         | `/keepr lock`                              | OWNER                          | manual | Lock joins                                 | `frontend/server/commands/families/keepr.ts` |
| `keepr_unlock`       | `/keepr unlock`                            | OWNER                          | manual | Unlock joins                               | `frontend/server/commands/families/keepr.ts` |
| `keepr_sync`         | `/keepr sync`                              | ADMIN/OWNER                    | manual | Request sync                               | `frontend/server/commands/families/keepr.ts` |
| `keepr_status`         | `/keepr status`                              | configured group               | manual | Runtime status summary                     | `frontend/server/commands/families/keepr.ts` |
| `keepr_auction`        | `/keepr auction`                             | configured group               | manual | Auction operational status                 | `frontend/server/commands/families/keepr.ts` |
| `keepr_solana`         | `/keepr solana`                              | configured group               | manual | Solana health summary                      | `frontend/server/commands/families/keepr.ts` |
| `keepr_health`         | `/keepr health`                              | configured group               | manual | Combined health                            | `frontend/server/commands/families/keepr.ts` |
| `keepr_tend`           | `/keepr tend [vault]`                        | ADMIN/OWNER                    | manual | Operational command                        | `frontend/server/commands/families/keepr.ts` |
| `keepr_report`         | `/keepr report [vault]`                      | ADMIN/OWNER                    | manual | Operational command                        | `frontend/server/commands/families/keepr.ts` |
| `keepr_settle_fees`    | `/keepr settle-fees`                         | ADMIN/OWNER                    | manual | Operational command                        | `frontend/server/commands/families/keepr.ts` |
| `keepr_relay_entries`  | `/keepr relay-entries`                       | ADMIN/OWNER                    | manual | Operational command                        | `frontend/server/commands/families/keepr.ts` |


## queue_api


| Action          | Endpoint / Method                      | Permission           | Mode          | Notes                          | Source                                             |
| --------------- | -------------------------------------- | -------------------- | ------------- | ------------------------------ | -------------------------------------------------- |
| `enqueue`       | `POST /api/keepr/actions/enqueue`      | Bearer KPR_API_KEY | manual/hybrid | Adds action to queue           | `frontend/api/_handlers/keepr/actions/_enqueue.ts` |
| `pending`       | `GET /api/keepr/actions/pending`       | Bearer KPR_API_KEY | automated     | Reads pending/retry actions    | `frontend/api/_handlers/_routes.keepr.ts`          |
| `execute`       | `POST /api/keepr/actions/execute`      | Bearer KPR_API_KEY | automated     | Executes single action         | `frontend/api/_handlers/keepr/actions/_execute.ts` |
| `update_status` | `POST /api/keepr/actions/updateStatus` | Bearer KPR_API_KEY | automated     | Updates action lifecycle state | `frontend/api/_handlers/_routes.keepr.ts`          |


## queue_action


| Action                     | Endpoint / Method                     | Permission                          | Mode      | Notes                      | Source                                       |
| -------------------------- | ------------------------------------- | ----------------------------------- | --------- | -------------------------- | -------------------------------------------- |
| `xmtp_add_member`          | `actionType=xmtp.group.add_member`    | keepr action queue                      | automated | XMTP membership add        | `frontend/server/keepr/xmtpQueueExecutor.ts` |
| `xmtp_remove_member`       | `actionType=xmtp.group.remove_member` | keepr action queue                      | automated | XMTP membership remove     | `frontend/server/keepr/xmtpQueueExecutor.ts` |
| `xmtp_send_message`        | `actionType=xmtp.group.send_message`  | keepr action queue                      | automated | XMTP message send          | `frontend/server/keepr/xmtpQueueExecutor.ts` |
| `xmtp_sync_members`        | `actionType=xmtp.group.sync_members`  | keepr action queue                      | automated | XMTP membership sync       | `frontend/server/keepr/xmtpQueueExecutor.ts` |
| `strategy_ajna_rebucket`   | `actionType=strategy.ajna.rebucket`   | canonical precheck + keepr action queue | automated | Executes setMinBucketIndex | `frontend/server/keepr/xmtpQueueExecutor.ts` |
| `strategy_charm_rebalance` | `actionType=strategy.charm.rebalance` | keepr action queue + onchain auth       | automated | Executes rebalance         | `frontend/server/keepr/xmtpQueueExecutor.ts` |


## bridge


| Action                    | Endpoint / Method                       | Permission           | Mode      | Notes                         | Source                                         |
| ------------------------- | --------------------------------------- | -------------------- | --------- | ----------------------------- | ---------------------------------------------- |
| `list_active_vaults`      | `GET /api/vaults/active`                | Bearer KPR_API_KEY | automated | Vault registry view           | `frontend/api/_handlers/_routes.ts`            |
| `keeper_tend`             | `POST /api/keeper/tend`                 | Bearer KPR_API_KEY | automated | Tend write bridge             | `frontend/api/_handlers/keeper/_tend.ts`       |
| `keeper_report`           | `POST /api/keeper/report`               | Bearer KPR_API_KEY | automated | Report write bridge           | `frontend/api/_handlers/keeper/_report.ts`     |
| `keeper_sweep`            | `POST /api/keeper/sweep`                | Bearer KPR_API_KEY | automated | Settlement write bridge       | `frontend/api/_handlers/keeper/_sweep.ts`      |
| `keeper_mark_settled`     | `POST /api/keeper/mark-settled`         | Bearer KPR_API_KEY | automated | Marks settlement stage        | `frontend/api/_handlers/_routes.ts`            |
| `keeper_alert`            | `POST /api/keeper/alert`                | Bearer KPR_API_KEY | automated | Alert forwarding              | `frontend/api/_handlers/_routes.ts`            |
| `keeper_ai_assess`        | `POST /api/keeper/aiAssess`             | Bearer KPR_API_KEY | automated | Assessment hook               | `frontend/api/_handlers/_routes.ts`            |
| `keeper_solana_reconcile` | `POST /api/keeper/solana/reconcile`     | Bearer KPR_API_KEY | automated | Solana reconcile hook         | `frontend/api/_handlers/_routes.ts`            |


## workflow


| Action                     | Endpoint / Method                                      | Permission                             | Mode      | Notes                                   | Source                                                 |
| -------------------------- | ------------------------------------------------------ | -------------------------------------- | --------- | --------------------------------------- | ------------------------------------------------------ |
| `unified_4626`             | `workflows/4626.workflow.ts`                       | workflow env+secrets                   | automated | Runs all core protocol automation tasks | `workflows/4626.workflow.ts`                       |
| `vault_keeper`             | `workflows/vault-keeper.workflow.ts`               | keeper authorization                   | automated | tend/report loop                        | `workflows/vault-keeper.workflow.ts`               |
| `payout_router_harvest`   | `workflows/payout-router-harvest.workflow.ts`      | keeper authorization                   | automated | claim and convertAndQueue               | `workflows/payout-router-harvest.workflow.ts`      |
| `ajna_bucket_manager`      | `workflows/ajna-bucket-manager.workflow.ts`        | canonical Ajna context                 | automated | setMinBucketIndex policy loop           | `workflows/ajna-bucket-manager.workflow.ts`        |
| `charm_rebalance_manager`  | `workflows/charm-rebalance-manager.workflow.ts`    | onchain auth checks                    | automated | rebalance threshold loop                | `workflows/charm-rebalance-manager.workflow.ts`    |
| `cca_finalization`        | `workflows/cca-finalization.workflow.ts`           | permissionless strategy calls + checks | automated | sweep/migrate/sweepUnsold path          | `workflows/cca-finalization.workflow.ts`           |
| `keepr_action_queue`      | `workflows/keepr-action-queue.workflow.ts`         | queue API key + XMTP creds             | automated | consume/execute/retry queue actions     | `workflows/keepr-action-queue.workflow.ts`         |
| `strategy_signal_listener` | `workflows/strategy-signal-listener.workflow.ts`  | ws rpc + queue auth                    | automated | Enqueues deduped Ajna/Charm actions     | `workflows/strategy-signal-listener.workflow.ts`   |
| `bridge_integrity_monitor` | `workflows/bridge-integrity-monitor.workflow.ts`   | monitor config                         | automated | Signer/route/scalar/liveness integrity  | `workflows/bridge-integrity-monitor.workflow.ts`   |
| `solana_relay_entries`     | `workflows/keepr-solana-relay-entries.workflow.ts` | solana+base creds                      | automated | Relay Solana entries to Base            | `workflows/keepr-solana-relay-entries.workflow.ts` |
| `solana_settle_fees`       | `workflows/keepr-solana-settle-fees.workflow.ts`   | solana+base creds                      | automated | Settle fees to Base gauge               | `workflows/keepr-solana-settle-fees.workflow.ts`   |
| `solana_winner_relay`      | `workflows/keepr-solana-winner-relay.workflow.ts`  | solana+base creds                      | automated | Relay winners Base to Solana            | `workflows/keepr-solana-winner-relay.workflow.ts`  |
| `solana_graduation_sync`   | `workflows/keepr-solana-graduation.workflow.ts`    | solana+base creds                      | automated | Close Alpha vault after graduation      | `workflows/keepr-solana-graduation.workflow.ts`    |
| `solana_price_monitor`     | `kpr/workflows/keepr-solana-price-monitor.workflow.ts` | solana+base creds                      | automated | Price deviation monitor/recenter        | `kpr/workflows/keepr-solana-price-monitor.workflow.ts` |


## onchain_method


| Action                     | Endpoint / Method                                | Permission                      | Mode      | Notes                           | Source                                             |
| -------------------------- | ------------------------------------------------ | ------------------------------- | --------- | ------------------------------- | -------------------------------------------------- |
| `vault_tend`               | `CreatorOVault.tend()`                           | keeper                          | automated | Idle funds deployment           | `kpr/actions/vault-keeper.action.ts`               |
| `vault_report`             | `CreatorOVault.report()`                         | keeper                          | automated | Harvest/report yields           | `kpr/actions/vault-keeper.action.ts`               |
| `payout_convert_and_queue` | `PayoutRouter.convertAndQueue()`                 | keeper/owner path               | automated | Routes payout balances          | `kpr/actions/payout-router-harvest.action.ts`    |
| `payout_claim_rewards`     | `PayoutRouter.claimAllProtocolRewards()`         | keeper/owner path               | automated | Optional protocol rewards claim | `kpr/actions/payout-router-harvest.action.ts`    |
| `ajna_set_min_bucket`      | `AjnaVaultAuth.setMinBucketIndex()`              | canonical CSW admin             | automated | Ajna rebucket execution         | `kpr/actions/ajna-bucket-manager.action.ts`        |
| `charm_rebalance`          | `CharmVault.rebalance()`                         | manager/delegate/keeper context | automated | Charm rebalance                 | `kpr/actions/charm-rebalance-manager.action.ts`    |
| `auction_sweep_currency`   | `CCAStrategy.sweepCurrency()`                    | permissionless                  | automated | Settlement phase                | `kpr/actions/cca-finalization.action.ts`         |
| `auction_migrate`          | `CCAStrategy.migrate()`                          | permissionless                  | automated | Settlement phase                | `kpr/actions/cca-finalization.action.ts`         |
| `auction_sweep_unsold`     | `CCAStrategy.sweepUnsoldTokens()`                | permissionless                  | automated | Settlement phase                | `kpr/actions/cca-finalization.action.ts`         |
| `auction_finalize_failed`  | `CCAStrategy.finalizeFailedAuction()`            | as configured                   | automated | Failure handling path           | `kpr/actions/cca-finalization.action.ts`         |
| `solana_process_entry`     | `LotteryManager.processLotteryEntryFromSolana()` | bridge relay authority          | automated | Solana entry relay write        | `kpr/actions/keepr-solana-relay-entries.action.ts` |
| `solana_receive_fee`       | `...receiveFeeFromSolana()`                      | bridge relay authority          | automated | Solana fee settlement write     | `kpr/actions/keepr-solana-settle-fees.action.ts`   |

