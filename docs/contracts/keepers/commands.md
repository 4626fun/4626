# Keepr Command Interface (MVP)

Keepr only responds to **explicit commands**.  
All commands must be deterministic and permission-checked.

---

## Command Prefix

All commands start with:

/keepr


---

## MVP Commands

### `/keepr help`

Show available commands and brief descriptions.

---

### `/keepr status`

Return:
- vault bindings
- canonical owner
- current configuration summary

---

### `/keepr rules`

Return:
- gating rules
- join lock state
- eligibility requirements

---

### `/keepr check`

Check eligibility for the **requester**.

Response includes:
- eligible: yes / no
- reason
- exact next steps

---

### `/keepr check 0x...`

Check eligibility for a specific wallet.

- ADMIN or OWNER only

---

### `/keepr lock`

Lock new joins.

- OWNER only

---

### `/keepr unlock`

Unlock new joins.

- OWNER only

---

### `/keepr sync`

Re-run eligibility checks for all members.

- ADMIN or OWNER only
- Must rate-limit and batch actions

---

## Optional (Not MVP Unless Enabled)

/keepr set-rule shares>=N
/keepr set-rule deposit>=AMOUNT


---

## Response Requirements

All responses must:

- be concise
- use bullet points
- include reasoning inputs  
  (balances, thresholds, block numbers)
- clearly explain denials and next steps

---

## Action Output Format

When an action is required, Keepr emits:

### Explanation

Short human-readable explanation.

### Action JSON

```json
{
  "action": "xmtp.group.add_member",
  "groupId": "<GROUP_ID>",
  "wallet": "0xabc...",
  "reason": "share_balance>=threshold",
  "evidence": {
    "shareBalance": "1200000000000000000",
    "threshold": "1000000000000000000",
    "blockNumber": 12345678
  }
}
```

If Keepr cannot execute actions directly, it must still emit the JSON.

## Chat Etiquette

- Do not respond to non-commands
- Do not interrupt conversation
- Prefer DM for denials/removals
- Avoid repetitive error messages


---

### Recommended repo structure


```
/keepr

├─ PROMPT.md
├─ COMMANDS.md
├─ CONFIG.md (future)
├─ ARCHITECTURE.md (future)
└─ README.md
```