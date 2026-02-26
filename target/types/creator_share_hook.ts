/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/creator_share_hook.json`.
 */
export type CreatorShareHook = {
  "address": "EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU",
  "metadata": {
    "name": "creatorShareHook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "CreatorVault Transfer Hook for Solana spoke — buy detection, lottery entry recording, fee harvesting, winner notification"
  },
  "instructions": [
    {
      "name": "addAmmProgram",
      "docs": [
        "Add a known AMM program to the allowlist."
      ],
      "discriminator": [
        132,
        162,
        30,
        203,
        13,
        113,
        189,
        106
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The config authority (must sign)."
          ],
          "signer": true
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — mutable for updates."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "programId",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "drainEntries",
      "docs": [
        "Keeper-only: read and clear PendingEntries for relay to Base.",
        "Returns entries to the keeper for batch relay via SolanaBridgeAdapter."
      ],
      "discriminator": [
        105,
        69,
        123,
        16,
        122,
        215,
        121,
        77
      ],
      "accounts": [
        {
          "name": "keeper",
          "docs": [
            "The keeper authority (must match `creator_config.keeper_authority`)."
          ],
          "signer": true
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — used to verify keeper authority."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "pendingEntries",
          "docs": [
            "PendingEntries PDA — zero-copy, mutable to drain entries."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "flushFees",
      "docs": [
        "Keeper-only: harvest withheld fees via Token-2022 CPI.",
        "Fees are collected to a designated account for bridging to Base."
      ],
      "discriminator": [
        64,
        201,
        33,
        26,
        252,
        245,
        24,
        79
      ],
      "accounts": [
        {
          "name": "keeper",
          "docs": [
            "The keeper authority (must match `creator_config.keeper_authority`)."
          ],
          "signer": true
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — used to verify keeper authority."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint with TransferFeeConfig extension."
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "The destination token account to receive harvested fees.",
            "Typically owned by the keeper or a fee collection wallet."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token-2022 program."
          ],
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "initializeCreator",
      "docs": [
        "Initialize a new creator mint configuration.",
        "Creates CreatorConfig + PendingEntries PDAs for the given mint."
      ],
      "discriminator": [
        29,
        153,
        44,
        99,
        52,
        172,
        81,
        115
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The authority creating this config (must sign)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint for this creator's share token."
          ]
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — initialized here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        },
        {
          "name": "pendingEntries",
          "docs": [
            "PendingEntries PDA — initialized here (zero-copy)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  101,
                  110,
                  116,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        },
        {
          "name": "winnerRecord",
          "docs": [
            "WinnerRecord PDA — initialized here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  110,
                  110,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeCreatorParams"
            }
          }
        }
      ]
    },
    {
      "name": "initializeExtraAccountMetaList",
      "docs": [
        "Initialize the extra account meta list required by the Transfer Hook interface.",
        "Must be called once per mint before the hook can fire."
      ],
      "discriminator": [
        92,
        197,
        174,
        197,
        41,
        124,
        19,
        3
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer for the PDA account creation."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint this hook is attached to."
          ]
        },
        {
          "name": "extraAccountMetaList",
          "docs": [
            "The extra-account-meta-list PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — must already exist (passed as extra account)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "pendingEntries",
          "docs": [
            "PendingEntries PDA — must already exist (passed as extra account)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  101,
                  110,
                  116,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "recordWinner",
      "docs": [
        "Keeper-only: record a lottery winner on Solana.",
        "Called by Keepr after a win is detected on Base."
      ],
      "discriminator": [
        226,
        137,
        193,
        48,
        217,
        3,
        14,
        171
      ],
      "accounts": [
        {
          "name": "keeper",
          "docs": [
            "The keeper authority (must match `creator_config.keeper_authority`)."
          ],
          "signer": true
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — used to verify keeper authority."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "winnerRecord",
          "docs": [
            "WinnerRecord PDA — mutable to update with new winner."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  110,
                  110,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        },
        {
          "name": "sharesPaid",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeAmmProgram",
      "docs": [
        "Remove a known AMM program from the allowlist."
      ],
      "discriminator": [
        79,
        211,
        59,
        105,
        233,
        84,
        46,
        95
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The config authority (must sign)."
          ],
          "signer": true
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — mutable for updates."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "programId",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "rotateKeeper",
      "docs": [
        "Rotate the keeper authority to a new pubkey."
      ],
      "discriminator": [
        201,
        88,
        117,
        249,
        81,
        101,
        255,
        55
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The config authority (must sign)."
          ],
          "signer": true
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — mutable for updates."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newKeeper",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "transferHook",
      "docs": [
        "Transfer Hook execute — named with Anchor discriminator.",
        "Also reachable via the SPL fallback below."
      ],
      "discriminator": [
        220,
        57,
        220,
        152,
        126,
        125,
        97,
        168
      ],
      "accounts": [
        {
          "name": "sourceTokenAccount",
          "docs": [
            "Source token account (tokens flow FROM here)."
          ]
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint."
          ]
        },
        {
          "name": "destinationTokenAccount",
          "docs": [
            "Destination token account (tokens flow TO here)."
          ]
        },
        {
          "name": "authority",
          "docs": [
            "Source authority (owner or delegate that signed the transfer)."
          ]
        },
        {
          "name": "extraAccountMetaList",
          "docs": [
            "Extra account meta list PDA (required by the interface)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — read-only for AMM detection."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "pendingEntries",
          "docs": [
            "PendingEntries PDA — zero-copy, writable to record buy entries."
          ],
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateConfig",
      "docs": [
        "Update CreatorConfig parameters (fee_bps, flush_threshold, etc.)."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The config authority (must sign)."
          ],
          "signer": true
        },
        {
          "name": "creatorMint",
          "docs": [
            "The Token-2022 mint (used for PDA derivation)."
          ]
        },
        {
          "name": "creatorConfig",
          "docs": [
            "CreatorConfig PDA — mutable for updates."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "creatorMint"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateConfigParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "creatorConfig",
      "discriminator": [
        208,
        169,
        98,
        27,
        194,
        199,
        95,
        86
      ]
    },
    {
      "name": "pendingEntries",
      "discriminator": [
        65,
        37,
        15,
        183,
        237,
        99,
        41,
        109
      ]
    },
    {
      "name": "winnerRecord",
      "discriminator": [
        248,
        27,
        49,
        33,
        45,
        88,
        210,
        100
      ]
    }
  ],
  "events": [
    {
      "name": "entriesDrained",
      "discriminator": [
        15,
        188,
        213,
        167,
        201,
        74,
        123,
        80
      ]
    },
    {
      "name": "entryOverflow",
      "discriminator": [
        143,
        68,
        228,
        65,
        142,
        11,
        115,
        120
      ]
    },
    {
      "name": "feesFlushed",
      "discriminator": [
        236,
        120,
        206,
        154,
        209,
        177,
        19,
        1
      ]
    },
    {
      "name": "keeperRotated",
      "discriminator": [
        230,
        110,
        254,
        107,
        219,
        25,
        251,
        115
      ]
    },
    {
      "name": "lotteryEntryRecorded",
      "discriminator": [
        145,
        22,
        143,
        202,
        131,
        170,
        102,
        171
      ]
    },
    {
      "name": "winnerNotified",
      "discriminator": [
        158,
        105,
        188,
        131,
        61,
        241,
        154,
        28
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedKeeper",
      "msg": "Unauthorized: caller is not the keeper authority"
    },
    {
      "code": 6001,
      "name": "unauthorizedAuthority",
      "msg": "Unauthorized: caller is not the config authority"
    },
    {
      "code": 6002,
      "name": "ammListFull",
      "msg": "AMM program list is full (max 8)"
    },
    {
      "code": 6003,
      "name": "ammNotFound",
      "msg": "AMM program not found in allowlist"
    },
    {
      "code": 6004,
      "name": "ammAlreadyExists",
      "msg": "AMM program already in allowlist"
    },
    {
      "code": 6005,
      "name": "lotteryDisabled",
      "msg": "Lottery is not enabled for this creator"
    },
    {
      "code": 6006,
      "name": "noPendingEntries",
      "msg": "No pending entries to drain"
    },
    {
      "code": 6007,
      "name": "invalidMint",
      "msg": "Invalid mint — does not match config"
    },
    {
      "code": 6008,
      "name": "overflowCounterMismatch",
      "msg": "PendingEntries buffer overflow counter mismatch"
    },
    {
      "code": 6009,
      "name": "invalidFeeBps",
      "msg": "Invalid fee BPS — must be <= 10000"
    },
    {
      "code": 6010,
      "name": "metaListAlreadyInitialized",
      "msg": "Extra account meta list already initialized"
    }
  ],
  "types": [
    {
      "name": "creatorConfig",
      "docs": [
        "Per-creator configuration PDA.",
        "",
        "Seeds: `[CREATOR_CONFIG_SEED, creator_mint.key()]`",
        "",
        "Stores fee parameters, keeper authority, known AMM programs for buy",
        "detection, and lottery enablement flag."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "docs": [
              "The SPL Token-2022 mint this config belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "authority",
            "docs": [
              "Authority that can update this config (typically deployer multisig)."
            ],
            "type": "pubkey"
          },
          {
            "name": "keeperAuthority",
            "docs": [
              "Authorized keeper pubkey — the only signer allowed to call",
              "`flush_fees`, `drain_entries`, and `record_winner`."
            ],
            "type": "pubkey"
          },
          {
            "name": "hubCreatorCoin",
            "docs": [
              "Hub Creator Coin address (Base) encoded as bytes32."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hubShareOft",
            "docs": [
              "Hub ShareOFT address (Base) encoded as bytes32."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feeBps",
            "docs": [
              "Fee in basis points (informational — actual fee is enforced by",
              "TransferFeeConfig on the mint, not by this program)."
            ],
            "type": "u16"
          },
          {
            "name": "flushThreshold",
            "docs": [
              "Minimum fee amount (in token smallest units) before `flush_fees`",
              "will execute. Set to 0 to flush on every call."
            ],
            "type": "u64"
          },
          {
            "name": "lotteryEnabled",
            "docs": [
              "Whether lottery entry recording is enabled.",
              "When false, the hook still executes but does not write entries."
            ],
            "type": "bool"
          },
          {
            "name": "ammProgramCount",
            "docs": [
              "Number of known AMM programs currently stored."
            ],
            "type": "u8"
          },
          {
            "name": "knownAmmPrograms",
            "docs": [
              "Known AMM program IDs for buy detection.",
              "If the source token account owner matches any of these, the",
              "transfer is classified as a \"buy\" and a lottery entry is recorded."
            ],
            "type": {
              "array": [
                "pubkey",
                8
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future upgrades."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "entriesDrained",
      "docs": [
        "Emitted when entries are drained by the keeper for relay to Base."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "count",
            "type": "u32"
          },
          {
            "name": "overflowCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "entryOverflow",
      "docs": [
        "Emitted when entries are dropped due to buffer overflow."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "totalOverflowCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "feesFlushed",
      "docs": [
        "Emitted when fees are flushed by the keeper."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "initializeCreatorParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "keeperAuthority",
            "docs": [
              "The authorized keeper pubkey for this creator."
            ],
            "type": "pubkey"
          },
          {
            "name": "hubCreatorCoin",
            "docs": [
              "Hub Creator Coin address (Base) encoded as bytes32."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hubShareOft",
            "docs": [
              "Hub ShareOFT address (Base) encoded as bytes32."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feeBps",
            "docs": [
              "Fee in basis points (informational, enforced by TransferFeeConfig)."
            ],
            "type": "u16"
          },
          {
            "name": "flushThreshold",
            "docs": [
              "Minimum withheld fee amount before flush_fees will execute."
            ],
            "type": "u64"
          },
          {
            "name": "lotteryEnabled",
            "docs": [
              "Whether lottery entry recording is enabled."
            ],
            "type": "bool"
          },
          {
            "name": "knownAmmPrograms",
            "docs": [
              "Initial known AMM programs for buy detection."
            ],
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "keeperRotated",
      "docs": [
        "Emitted when the keeper authority is rotated."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "oldKeeper",
            "type": "pubkey"
          },
          {
            "name": "newKeeper",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "lotteryEntry",
      "docs": [
        "A single lottery entry recorded by the Transfer Hook on a buy.",
        "",
        "Uses `#[zero_copy]` so it can live inside the zero-copy `PendingEntries` account",
        "without blowing the SBF stack limit during deserialization."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "docs": [
              "The buyer's wallet pubkey (destination token account owner)."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount of tokens transferred (in mint's smallest denomination)."
            ],
            "type": "u64"
          },
          {
            "name": "slot",
            "docs": [
              "Solana slot at which the buy occurred."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lotteryEntryRecorded",
      "docs": [
        "Emitted when a buy is detected and a lottery entry is recorded."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "bufferCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "pendingEntries",
      "docs": [
        "Ring buffer of pending lottery entries for a creator mint.",
        "",
        "Seeds: `[PENDING_ENTRIES_SEED, creator_mint.key()]`",
        "",
        "Uses zero-copy deserialization (`AccountLoader`) to avoid placing the",
        "12KB buffer on the SBF stack. The runtime memory-maps the account data",
        "directly, keeping stack usage minimal.",
        "",
        "The keeper drains this buffer periodically and relays entries to Base.",
        "Overflow policy: drop-oldest (head advances, oldest overwritten)."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "docs": [
              "The creator mint this buffer belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "head",
            "docs": [
              "Write pointer — next slot to write into."
            ],
            "type": "u32"
          },
          {
            "name": "count",
            "docs": [
              "Number of entries currently in the buffer (0..=MAX_PENDING_ENTRIES)."
            ],
            "type": "u32"
          },
          {
            "name": "overflowCount",
            "docs": [
              "Total number of entries dropped due to overflow.",
              "Keepr monitors this counter between polls."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation."
            ],
            "type": "u8"
          },
          {
            "name": "padding",
            "docs": [
              "Alignment padding (zero-copy requires C-repr alignment)."
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "entries",
            "docs": [
              "The ring buffer itself."
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "lotteryEntry"
                  }
                },
                256
              ]
            }
          }
        ]
      }
    },
    {
      "name": "updateConfigParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hubCreatorCoin",
            "docs": [
              "New hub_creator_coin (None = keep current)."
            ],
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "hubShareOft",
            "docs": [
              "New hub_share_oft (None = keep current)."
            ],
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "feeBps",
            "docs": [
              "New fee_bps (None = keep current)."
            ],
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "flushThreshold",
            "docs": [
              "New flush_threshold (None = keep current)."
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "lotteryEnabled",
            "docs": [
              "New lottery_enabled (None = keep current)."
            ],
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "winnerNotified",
      "docs": [
        "Emitted when a winner is recorded on Solana."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "sharesPaid",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "winnerRecord",
      "docs": [
        "Latest lottery winner record for a creator mint.",
        "",
        "Seeds: `[WINNER_RECORD_SEED, creator_mint.key()]`",
        "",
        "Written by the keeper when a win is detected on Base.",
        "Frontend subscribes to this PDA for \"You won!\" notifications."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creatorMint",
            "docs": [
              "The creator mint this record belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "winner",
            "docs": [
              "The winner's Solana wallet pubkey."
            ],
            "type": "pubkey"
          },
          {
            "name": "sharesPaid",
            "docs": [
              "Amount of vault shares paid to the winner (in Base token units)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp when the win was recorded on Solana."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA derivation."
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
