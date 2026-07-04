export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          coin_address: string | null
          created_at: string
          decision_note: string | null
          id: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          coin_address?: string | null
          created_at?: string
          decision_note?: string | null
          id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          coin_address?: string | null
          created_at?: string
          decision_note?: string | null
          id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      account_linked_methods: {
        Row: {
          created_at: string
          id: string
          privy_user_id: string
          type: string
          value: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          privy_user_id: string
          type: string
          value: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          privy_user_id?: string
          type?: string
          value?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "account_linked_methods_privy_user_id_fkey"
            columns: ["privy_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["privy_user_id"]
          },
          {
            foreignKeyName: "account_linked_methods_privy_user_id_fkey"
            columns: ["privy_user_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["privy_user_id"]
          },
        ]
      }
      account_zora_signals: {
        Row: {
          canonical_csw_address: string | null
          creator_coin_address: string | null
          last_resolved_at: string | null
          privy_user_id: string
          updated_at: string
          zora_handle: string | null
          zora_linked: boolean
        }
        Insert: {
          canonical_csw_address?: string | null
          creator_coin_address?: string | null
          last_resolved_at?: string | null
          privy_user_id: string
          updated_at?: string
          zora_handle?: string | null
          zora_linked?: boolean
        }
        Update: {
          canonical_csw_address?: string | null
          creator_coin_address?: string | null
          last_resolved_at?: string | null
          privy_user_id?: string
          updated_at?: string
          zora_handle?: string | null
          zora_linked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "account_zora_signals_privy_user_id_fkey"
            columns: ["privy_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["privy_user_id"]
          },
          {
            foreignKeyName: "account_zora_signals_privy_user_id_fkey"
            columns: ["privy_user_id"]
            isOneToOne: true
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["privy_user_id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          admin_address: string
          created_at: string
          details: Json | null
          id: number
          ip_address: string | null
          ip_hash: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_address: string
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: string | null
          ip_hash?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_address?: string
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: string | null
          ip_hash?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      agent_api_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: number
          ip_hash: string | null
          method: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: number
          ip_hash?: string | null
          method: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: number
          ip_hash?: string | null
          method?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      agent_background_tasks: {
        Row: {
          attempts: number
          created_at: string
          id: number
          last_error: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          payload_json: Json
          priority: number
          run_after: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          payload_json?: Json
          priority?: number
          run_after?: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          payload_json?: Json
          priority?: number
          run_after?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_control_audit_events: {
        Row: {
          action: string
          actor_id: string
          actor_type: string
          capability_id: string
          correlation_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          event_id: string
          event_type: string
          metadata_json: Json
          proposal_id: string
          reason: string | null
          status: string
          subsystem: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_type: string
          capability_id: string
          correlation_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          metadata_json?: Json
          proposal_id: string
          reason?: string | null
          status: string
          subsystem: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_type?: string
          capability_id?: string
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          metadata_json?: Json
          proposal_id?: string
          reason?: string | null
          status?: string
          subsystem?: string
        }
        Relationships: []
      }
      agent_message_memory: {
        Row: {
          agent_id: string
          content: string
          conversation_id: string
          conversation_type: string | null
          created_at: string
          embedding: string | null
          entity_id: string | null
          id: string
          metadata_json: Json | null
          role: string
          room_id: string
          sender_address: string | null
        }
        Insert: {
          agent_id: string
          content: string
          conversation_id: string
          conversation_type?: string | null
          created_at?: string
          embedding?: string | null
          entity_id?: string | null
          id: string
          metadata_json?: Json | null
          role: string
          room_id: string
          sender_address?: string | null
        }
        Update: {
          agent_id?: string
          content?: string
          conversation_id?: string
          conversation_type?: string | null
          created_at?: string
          embedding?: string | null
          entity_id?: string | null
          id?: string
          metadata_json?: Json | null
          role?: string
          room_id?: string
          sender_address?: string | null
        }
        Relationships: []
      }
      agent_rate_limits: {
        Row: {
          count: number
          created_at: string
          key: string
          window_id: number
        }
        Insert: {
          count?: number
          created_at?: string
          key: string
          window_id: number
        }
        Update: {
          count?: number
          created_at?: string
          key?: string
          window_id?: number
        }
        Relationships: []
      }
      agent_registration_state: {
        Row: {
          agent_key: string
          gateway_url: string | null
          lens_uri: string
          payload_hash: string
          storage_key: string | null
          updated_at: string
        }
        Insert: {
          agent_key: string
          gateway_url?: string | null
          lens_uri: string
          payload_hash: string
          storage_key?: string | null
          updated_at?: string
        }
        Update: {
          agent_key?: string
          gateway_url?: string | null
          lens_uri?: string
          payload_hash?: string
          storage_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_runtime_leases: {
        Row: {
          created_at: string
          heartbeat_at: string
          lease_key: string
          owner_id: string
          runtime_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          heartbeat_at?: string
          lease_key: string
          owner_id: string
          runtime_role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          heartbeat_at?: string
          lease_key?: string
          owner_id?: string
          runtime_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      ajna_vaults: {
        Row: {
          ajna_auth: string
          ajna_pool: string
          automation_status: string
          buffer_ratio_bps: number | null
          chain_id: number
          created_at: string
          creator_token: string
          creator_vault: string
          inner_ajna_vault: string
          last_error: string | null
          last_run_at: string | null
          last_success_tx: string | null
          max_assets_per_move: number | null
          max_bucket_step: number
          metadata: Json
          min_bucket_index: number | null
          owner_address: string
          strategy_adapter: string
          updated_at: string
        }
        Insert: {
          ajna_auth: string
          ajna_pool: string
          automation_status?: string
          buffer_ratio_bps?: number | null
          chain_id: number
          created_at?: string
          creator_token: string
          creator_vault: string
          inner_ajna_vault: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_tx?: string | null
          max_assets_per_move?: number | null
          max_bucket_step?: number
          metadata?: Json
          min_bucket_index?: number | null
          owner_address: string
          strategy_adapter: string
          updated_at?: string
        }
        Update: {
          ajna_auth?: string
          ajna_pool?: string
          automation_status?: string
          buffer_ratio_bps?: number | null
          chain_id?: number
          created_at?: string
          creator_token?: string
          creator_vault?: string
          inner_ajna_vault?: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_tx?: string | null
          max_assets_per_move?: number | null
          max_bucket_step?: number
          metadata?: Json
          min_bucket_index?: number | null
          owner_address?: string
          strategy_adapter?: string
          updated_at?: string
        }
        Relationships: []
      }
      alfaclub_creators: {
        Row: {
          creator_address: string
          minted_at: string
          minted_at_block: number
          staking_pool: string | null
          token_id: number
          updated_at: string
        }
        Insert: {
          creator_address: string
          minted_at?: string
          minted_at_block: number
          staking_pool?: string | null
          token_id: number
          updated_at?: string
        }
        Update: {
          creator_address?: string
          minted_at?: string
          minted_at_block?: number
          staking_pool?: string | null
          token_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      alfaclub_explore_latest: {
        Row: {
          action: string | null
          creator_address: string | null
          creator_twitter_username: string | null
          event_time_ms: number | null
          ingested_at: string
          raw: Json
          room_id: number | null
          room_name: string | null
          unique_hash: string
        }
        Insert: {
          action?: string | null
          creator_address?: string | null
          creator_twitter_username?: string | null
          event_time_ms?: number | null
          ingested_at?: string
          raw: Json
          room_id?: number | null
          room_name?: string | null
          unique_hash: string
        }
        Update: {
          action?: string | null
          creator_address?: string | null
          creator_twitter_username?: string | null
          event_time_ms?: number | null
          ingested_at?: string
          raw?: Json
          room_id?: number | null
          room_name?: string | null
          unique_hash?: string
        }
        Relationships: []
      }
      alfaclub_indexer_cursor: {
        Row: {
          cursor_key: string
          last_block: number
          updated_at: string
        }
        Insert: {
          cursor_key: string
          last_block: number
          updated_at?: string
        }
        Update: {
          cursor_key?: string
          last_block?: number
          updated_at?: string
        }
        Relationships: []
      }
      alfaclub_metrics_snapshot: {
        Row: {
          creator_address: string
          hl_account_value: number | null
          pnl_30d_usd: number | null
          rank: number
          score: number
          snapshot_ts: string
          staked_supply: number
          token_id: number
          total_supply: number
        }
        Insert: {
          creator_address: string
          hl_account_value?: number | null
          pnl_30d_usd?: number | null
          rank?: number
          score?: number
          snapshot_ts: string
          staked_supply?: number
          token_id: number
          total_supply?: number
        }
        Update: {
          creator_address?: string
          hl_account_value?: number | null
          pnl_30d_usd?: number | null
          rank?: number
          score?: number
          snapshot_ts?: string
          staked_supply?: number
          token_id?: number
          total_supply?: number
        }
        Relationships: []
      }
      alfaclub_publications: {
        Row: {
          created_at: string
          creator_address: string
          erc8004_calldata: string | null
          erc8004_tx_hash: string | null
          kind: string
          last_submission_at: string | null
          last_submission_error: string | null
          lens_post_id: string | null
          publication_key: string
          rank: number | null
          score: number | null
          scorecard_cid: string | null
          scorecard_hash: string | null
          scorecard_uri: string | null
          submission_attempts: number
          token_id: string | null
        }
        Insert: {
          created_at?: string
          creator_address: string
          erc8004_calldata?: string | null
          erc8004_tx_hash?: string | null
          kind: string
          last_submission_at?: string | null
          last_submission_error?: string | null
          lens_post_id?: string | null
          publication_key: string
          rank?: number | null
          score?: number | null
          scorecard_cid?: string | null
          scorecard_hash?: string | null
          scorecard_uri?: string | null
          submission_attempts?: number
          token_id?: string | null
        }
        Update: {
          created_at?: string
          creator_address?: string
          erc8004_calldata?: string | null
          erc8004_tx_hash?: string | null
          kind?: string
          last_submission_at?: string | null
          last_submission_error?: string | null
          lens_post_id?: string | null
          publication_key?: string
          rank?: number | null
          score?: number | null
          scorecard_cid?: string | null
          scorecard_hash?: string | null
          scorecard_uri?: string | null
          submission_attempts?: number
          token_id?: string | null
        }
        Relationships: []
      }
      alfaclub_rooms_snapshot: {
        Row: {
          buy_price: number | null
          created_at: string | null
          creator_address: string | null
          creator_ethos_score: number | null
          creator_points: number | null
          creator_twitter_username: string | null
          current_supply: number | null
          featured: boolean | null
          fund_size: number | null
          image_url: string | null
          ingested_at: string
          metadata_id: string | null
          mid_price: number | null
          pnl: number | null
          pnl_percentage_30d: number | null
          pnl_percentage_7d: number | null
          pnl_percentage_all_time: number | null
          polymarket_deposit_wallet_address: string | null
          polymarket_proxy_address: string | null
          raw: Json
          room_description: string | null
          room_id: number
          room_name: string | null
          room_type: string | null
          sell_price: number | null
          sn: string | null
          source: string
          tier: string | null
          unique_holders: number | null
          updated_at: string | null
          volume: number | null
          wallet_address: string | null
        }
        Insert: {
          buy_price?: number | null
          created_at?: string | null
          creator_address?: string | null
          creator_ethos_score?: number | null
          creator_points?: number | null
          creator_twitter_username?: string | null
          current_supply?: number | null
          featured?: boolean | null
          fund_size?: number | null
          image_url?: string | null
          ingested_at?: string
          metadata_id?: string | null
          mid_price?: number | null
          pnl?: number | null
          pnl_percentage_30d?: number | null
          pnl_percentage_7d?: number | null
          pnl_percentage_all_time?: number | null
          polymarket_deposit_wallet_address?: string | null
          polymarket_proxy_address?: string | null
          raw: Json
          room_description?: string | null
          room_id: number
          room_name?: string | null
          room_type?: string | null
          sell_price?: number | null
          sn?: string | null
          source?: string
          tier?: string | null
          unique_holders?: number | null
          updated_at?: string | null
          volume?: number | null
          wallet_address?: string | null
        }
        Update: {
          buy_price?: number | null
          created_at?: string | null
          creator_address?: string | null
          creator_ethos_score?: number | null
          creator_points?: number | null
          creator_twitter_username?: string | null
          current_supply?: number | null
          featured?: boolean | null
          fund_size?: number | null
          image_url?: string | null
          ingested_at?: string
          metadata_id?: string | null
          mid_price?: number | null
          pnl?: number | null
          pnl_percentage_30d?: number | null
          pnl_percentage_7d?: number | null
          pnl_percentage_all_time?: number | null
          polymarket_deposit_wallet_address?: string | null
          polymarket_proxy_address?: string | null
          raw?: Json
          room_description?: string | null
          room_id?: number
          room_name?: string | null
          room_type?: string | null
          sell_price?: number | null
          sn?: string | null
          source?: string
          tier?: string | null
          unique_holders?: number | null
          updated_at?: string | null
          volume?: number | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      alfaclub_runtime_secret: {
        Row: {
          expires_at: string | null
          secret_key: string
          secret_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          expires_at?: string | null
          secret_key: string
          secret_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          expires_at?: string | null
          secret_key?: string
          secret_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      allowlist: {
        Row: {
          address: string
          approved_at: string
          approved_by: string | null
          csw_address: string | null
          note: string | null
          revoked_at: string | null
        }
        Insert: {
          address: string
          approved_at?: string
          approved_by?: string | null
          csw_address?: string | null
          note?: string | null
          revoked_at?: string | null
        }
        Update: {
          address?: string
          approved_at?: string
          approved_by?: string | null
          csw_address?: string | null
          note?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      amoe_burn_credits_intents: {
        Row: {
          created_at: string
          signup_id: number
          spend_ref_id: string
        }
        Insert: {
          created_at?: string
          signup_id: number
          spend_ref_id: string
        }
        Update: {
          created_at?: string
          signup_id?: number
          spend_ref_id?: string
        }
        Relationships: []
      }
      amoe_points_burn_ledger: {
        Row: {
          epoch: number
          leaf_hash_hex: string
          points_burned: number
          points_burned_as_usd: number
          projected_at: string
          publisher_run_id: string
          signup_id: number
          signup_id_hash_hex: string
          source_points_id: number
          spend_ref_id: string
          spend_ref_id_hash_hex: string
          twitter_credit_nullifier_hex: string
          wallet_addr_commit_hex: string
          wallet_address: string
        }
        Insert: {
          epoch: number
          leaf_hash_hex: string
          points_burned: number
          points_burned_as_usd: number
          projected_at?: string
          publisher_run_id: string
          signup_id: number
          signup_id_hash_hex: string
          source_points_id: number
          spend_ref_id: string
          spend_ref_id_hash_hex: string
          twitter_credit_nullifier_hex: string
          wallet_addr_commit_hex: string
          wallet_address: string
        }
        Update: {
          epoch?: number
          leaf_hash_hex?: string
          points_burned?: number
          points_burned_as_usd?: number
          projected_at?: string
          publisher_run_id?: string
          signup_id?: number
          signup_id_hash_hex?: string
          source_points_id?: number
          spend_ref_id?: string
          spend_ref_id_hash_hex?: string
          twitter_credit_nullifier_hex?: string
          wallet_addr_commit_hex?: string
          wallet_address?: string
        }
        Relationships: []
      }
      amoe_points_burn_ledger_snapshots: {
        Row: {
          built_at: string
          epoch: number
          leaf_count: number
          publish_block_number: number | null
          publish_confirmed_at: string | null
          publish_tx_hash: string | null
          publisher_run_id: string
          publisher_version: string
          root_hex: string
          tree_blob: Json
          tree_depth: number
        }
        Insert: {
          built_at?: string
          epoch: number
          leaf_count: number
          publish_block_number?: number | null
          publish_confirmed_at?: string | null
          publish_tx_hash?: string | null
          publisher_run_id: string
          publisher_version: string
          root_hex: string
          tree_blob: Json
          tree_depth?: number
        }
        Update: {
          built_at?: string
          epoch?: number
          leaf_count?: number
          publish_block_number?: number | null
          publish_confirmed_at?: string | null
          publish_tx_hash?: string | null
          publisher_run_id?: string
          publisher_version?: string
          root_hex?: string
          tree_blob?: Json
          tree_depth?: number
        }
        Relationships: []
      }
      amoe_publisher_runs: {
        Row: {
          claimed_at: string
          claimed_by: string
          epoch: number
          finished_at: string | null
          id: string
          last_error: string | null
          phase: string
          snapshot_epoch: number | null
          started_at: string
        }
        Insert: {
          claimed_at?: string
          claimed_by: string
          epoch: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          phase: string
          snapshot_epoch?: number | null
          started_at?: string
        }
        Update: {
          claimed_at?: string
          claimed_by?: string
          epoch?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          phase?: string
          snapshot_epoch?: number | null
          started_at?: string
        }
        Relationships: []
      }
      amoe_zk_submissions: {
        Row: {
          block_number: number | null
          broadcast_at: string | null
          created_at: string
          creator_coin: string
          epoch: number
          id: string
          last_retry_error: string | null
          manager_entry_id: number | null
          next_retry_at: string | null
          nonce_commit_hex: string | null
          points_burn_nullifier_hex: string | null
          points_burned: number
          proof_blob: Json | null
          proof_kept_until: string | null
          proven_at: string | null
          retry_count: number
          retry_started_at: string | null
          settled_at: string | null
          signup_id: number
          spend_ref_id: string
          state: string
          state_reason: string | null
          twitter_credit_nullifier_hex: string | null
          tx_hash: string | null
          wallet_address: string
          wallet_commit_hex: string | null
        }
        Insert: {
          block_number?: number | null
          broadcast_at?: string | null
          created_at?: string
          creator_coin: string
          epoch: number
          id?: string
          last_retry_error?: string | null
          manager_entry_id?: number | null
          next_retry_at?: string | null
          nonce_commit_hex?: string | null
          points_burn_nullifier_hex?: string | null
          points_burned: number
          proof_blob?: Json | null
          proof_kept_until?: string | null
          proven_at?: string | null
          retry_count?: number
          retry_started_at?: string | null
          settled_at?: string | null
          signup_id: number
          spend_ref_id: string
          state: string
          state_reason?: string | null
          twitter_credit_nullifier_hex?: string | null
          tx_hash?: string | null
          wallet_address: string
          wallet_commit_hex?: string | null
        }
        Update: {
          block_number?: number | null
          broadcast_at?: string | null
          created_at?: string
          creator_coin?: string
          epoch?: number
          id?: string
          last_retry_error?: string | null
          manager_entry_id?: number | null
          next_retry_at?: string | null
          nonce_commit_hex?: string | null
          points_burn_nullifier_hex?: string | null
          points_burned?: number
          proof_blob?: Json | null
          proof_kept_until?: string | null
          proven_at?: string | null
          retry_count?: number
          retry_started_at?: string | null
          settled_at?: string | null
          signup_id?: number
          spend_ref_id?: string
          state?: string
          state_reason?: string | null
          twitter_credit_nullifier_hex?: string | null
          tx_hash?: string | null
          wallet_address?: string
          wallet_commit_hex?: string | null
        }
        Relationships: []
      }
      auth_agent_nonces: {
        Row: {
          agent_id: number
          agent_registry: string
          consumed_at: string | null
          created_by_address: string | null
          expires_at: string
          issued_at: string
          nonce: string
          owner_address: string
        }
        Insert: {
          agent_id: number
          agent_registry: string
          consumed_at?: string | null
          created_by_address?: string | null
          expires_at: string
          issued_at?: string
          nonce: string
          owner_address: string
        }
        Update: {
          agent_id?: number
          agent_registry?: string
          consumed_at?: string | null
          created_by_address?: string | null
          expires_at?: string
          issued_at?: string
          nonce?: string
          owner_address?: string
        }
        Relationships: []
      }
      auth_handoffs: {
        Row: {
          address: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          privy_token: string | null
        }
        Insert: {
          address: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          privy_token?: string | null
        }
        Update: {
          address?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          privy_token?: string | null
        }
        Relationships: []
      }
      auth_nonces: {
        Row: {
          consumed_at: string | null
          expires_at: string
          issued_at: string
          nonce: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at: string
          issued_at?: string
          nonce: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          issued_at?: string
          nonce?: string
        }
        Relationships: []
      }
      backtest_market_bars_1m: {
        Row: {
          bar_time: string
          close: number
          fetched_at: string
          high: number
          interval: string
          low: number
          market: string
          open: number
          source: string
          symbol: string
          volume: number | null
        }
        Insert: {
          bar_time: string
          close: number
          fetched_at?: string
          high: number
          interval?: string
          low: number
          market: string
          open: number
          source?: string
          symbol: string
          volume?: number | null
        }
        Update: {
          bar_time?: string
          close?: number
          fetched_at?: string
          high?: number
          interval?: string
          low?: number
          market?: string
          open?: number
          source?: string
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      canonical_ethos_scores: {
        Row: {
          canonical_user_id: number
          level: string | null
          score: number | null
          score_fetched_at: string | null
          selected_userkey: string | null
          source_identity_type: string | null
          updated_at: string
        }
        Insert: {
          canonical_user_id: number
          level?: string | null
          score?: number | null
          score_fetched_at?: string | null
          selected_userkey?: string | null
          source_identity_type?: string | null
          updated_at?: string
        }
        Update: {
          canonical_user_id?: number
          level?: string | null
          score?: number | null
          score_fetched_at?: string | null
          selected_userkey?: string | null
          source_identity_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_ethos_scores_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_ethos_scores_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: true
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      chat_command_center_events: {
        Row: {
          command_id: string | null
          conversation_id: string | null
          conversation_type: string | null
          created_at: string
          event: string
          id: number
          payload: Json | null
          source: string | null
        }
        Insert: {
          command_id?: string | null
          conversation_id?: string | null
          conversation_type?: string | null
          created_at?: string
          event: string
          id?: number
          payload?: Json | null
          source?: string | null
        }
        Update: {
          command_id?: string | null
          conversation_id?: string | null
          conversation_type?: string | null
          created_at?: string
          event?: string
          id?: number
          payload?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      chat_friend_requests: {
        Row: {
          addressee_wallet: string
          created_at: string
          requester_wallet: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          addressee_wallet: string
          created_at?: string
          requester_wallet: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_wallet?: string
          created_at?: string
          requester_wallet?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_presence_sessions: {
        Row: {
          available_until: string
          canonical_wallet: string
          created_at: string
          last_seen_at: string
          privacy_visible: boolean
          profile_id: number | null
          session_id_hash: string
          status: string
          updated_at: string
          user_agent_hash: string | null
          xmtp_address: string | null
        }
        Insert: {
          available_until?: string
          canonical_wallet: string
          created_at?: string
          last_seen_at?: string
          privacy_visible?: boolean
          profile_id?: number | null
          session_id_hash: string
          status?: string
          updated_at?: string
          user_agent_hash?: string | null
          xmtp_address?: string | null
        }
        Update: {
          available_until?: string
          canonical_wallet?: string
          created_at?: string
          last_seen_at?: string
          privacy_visible?: boolean
          profile_id?: number | null
          session_id_hash?: string
          status?: string
          updated_at?: string
          user_agent_hash?: string | null
          xmtp_address?: string | null
        }
        Relationships: []
      }
      command_issuer_daily_spend: {
        Row: {
          profile_id: number
          spent_wei: number
          updated_at: string
          ymd: string
        }
        Insert: {
          profile_id: number
          spent_wei?: number
          updated_at?: string
          ymd: string
        }
        Update: {
          profile_id?: number
          spent_wei?: number
          updated_at?: string
          ymd?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_issuer_daily_spend_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_issuer_daily_spend_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      command_issuer_execution_context: {
        Row: {
          caps_version: number
          daily_cap_wei: number
          owner_eoa_address: string
          owner_index: number
          parent_csw_address: string | null
          paymaster_policy: string
          per_tx_cap_wei: number
          privy_owner_wallet_id: string
          profile_id: number
          provisioned_at: string
          provisioned_by: string | null
          provisioning_source: string | null
          revoked_at: string | null
          revoked_reason: string | null
          smart_wallet_address: string
          spend_allowance_wei: number | null
          spend_period_seconds: number | null
          spend_permission_end_at: string | null
          spend_permission_hash: string | null
          spend_permission_payload: Json | null
          spend_permission_revoked_at: string | null
          spend_permission_signature: string | null
          sub_account_address: string | null
          updated_at: string
        }
        Insert: {
          caps_version?: number
          daily_cap_wei: number
          owner_eoa_address: string
          owner_index?: number
          parent_csw_address?: string | null
          paymaster_policy?: string
          per_tx_cap_wei: number
          privy_owner_wallet_id: string
          profile_id: number
          provisioned_at?: string
          provisioned_by?: string | null
          provisioning_source?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          smart_wallet_address: string
          spend_allowance_wei?: number | null
          spend_period_seconds?: number | null
          spend_permission_end_at?: string | null
          spend_permission_hash?: string | null
          spend_permission_payload?: Json | null
          spend_permission_revoked_at?: string | null
          spend_permission_signature?: string | null
          sub_account_address?: string | null
          updated_at?: string
        }
        Update: {
          caps_version?: number
          daily_cap_wei?: number
          owner_eoa_address?: string
          owner_index?: number
          parent_csw_address?: string | null
          paymaster_policy?: string
          per_tx_cap_wei?: number
          privy_owner_wallet_id?: string
          profile_id?: number
          provisioned_at?: string
          provisioned_by?: string | null
          provisioning_source?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          smart_wallet_address?: string
          spend_allowance_wei?: number | null
          spend_period_seconds?: number | null
          spend_permission_end_at?: string | null
          spend_permission_hash?: string | null
          spend_permission_payload?: Json | null
          spend_permission_revoked_at?: string | null
          spend_permission_signature?: string | null
          sub_account_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_issuer_execution_context_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_issuer_execution_context_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      control_plane_events: {
        Row: {
          created_at: string
          data_json: Json
          event_type: string
          id: number
          message: string
          operation_id: string
          stage_id: string | null
        }
        Insert: {
          created_at?: string
          data_json?: Json
          event_type: string
          id?: number
          message?: string
          operation_id: string
          stage_id?: string | null
        }
        Update: {
          created_at?: string
          data_json?: Json
          event_type?: string
          id?: number
          message?: string
          operation_id?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_plane_events_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "control_plane_operations"
            referencedColumns: ["operation_id"]
          },
          {
            foreignKeyName: "control_plane_events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "control_plane_stages"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      control_plane_operations: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: number
          idempotency_fingerprint: string | null
          idempotency_key: string | null
          input_hash: string | null
          input_json: Json
          lock_key: string | null
          lock_scope: string | null
          operation_id: string
          operation_kind: string
          policy_version: string | null
          requested_by: string | null
          result_json: Json | null
          schema_version: string
          scope_id: string
          scope_type: string
          status: string
          updated_at: string
          vault_address: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          idempotency_fingerprint?: string | null
          idempotency_key?: string | null
          input_hash?: string | null
          input_json?: Json
          lock_key?: string | null
          lock_scope?: string | null
          operation_id: string
          operation_kind: string
          policy_version?: string | null
          requested_by?: string | null
          result_json?: Json | null
          schema_version?: string
          scope_id?: string
          scope_type?: string
          status: string
          updated_at?: string
          vault_address?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          idempotency_fingerprint?: string | null
          idempotency_key?: string | null
          input_hash?: string | null
          input_json?: Json
          lock_key?: string | null
          lock_scope?: string | null
          operation_id?: string
          operation_kind?: string
          policy_version?: string | null
          requested_by?: string | null
          result_json?: Json | null
          schema_version?: string
          scope_id?: string
          scope_type?: string
          status?: string
          updated_at?: string
          vault_address?: string | null
        }
        Relationships: []
      }
      control_plane_stages: {
        Row: {
          attempt_count: number
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: number
          input_json: Json
          operation_id: string
          result_json: Json | null
          stage_id: string
          stage_kind: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          input_json?: Json
          operation_id: string
          result_json?: Json | null
          stage_id: string
          stage_kind: string
          started_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: number
          input_json?: Json
          operation_id?: string
          result_json?: Json | null
          stage_id?: string
          stage_kind?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_plane_stages_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "control_plane_operations"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      creator_coins: {
        Row: {
          chain_id: number
          coin_address: string
          created_at: string | null
          creator_address: string
          fee_model: string
          fees_24h_usd: number | null
          last_seen_at: string
          market_cap_delta_24h: number | null
          market_cap_usd: number | null
          sparkline_30d_change_pct: number | null
          sparkline_30d_updated_at: string | null
          sparkline_30d_values: Json | null
          unique_holders: number | null
          volume_24h_usd: number | null
        }
        Insert: {
          chain_id?: number
          coin_address: string
          created_at?: string | null
          creator_address: string
          fee_model?: string
          fees_24h_usd?: number | null
          last_seen_at?: string
          market_cap_delta_24h?: number | null
          market_cap_usd?: number | null
          sparkline_30d_change_pct?: number | null
          sparkline_30d_updated_at?: string | null
          sparkline_30d_values?: Json | null
          unique_holders?: number | null
          volume_24h_usd?: number | null
        }
        Update: {
          chain_id?: number
          coin_address?: string
          created_at?: string | null
          creator_address?: string
          fee_model?: string
          fees_24h_usd?: number | null
          last_seen_at?: string
          market_cap_delta_24h?: number | null
          market_cap_usd?: number | null
          sparkline_30d_change_pct?: number | null
          sparkline_30d_updated_at?: string | null
          sparkline_30d_values?: Json | null
          unique_holders?: number | null
          volume_24h_usd?: number | null
        }
        Relationships: []
      }
      creator_ethos_daily_snapshots: {
        Row: {
          creator_address: string
          ethos_level: string | null
          ethos_score: number | null
          ethos_score_source: string | null
          market_cap_usd: number | null
          snapshot_date: string
          volume_24h_usd: number | null
        }
        Insert: {
          creator_address: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_source?: string | null
          market_cap_usd?: number | null
          snapshot_date: string
          volume_24h_usd?: number | null
        }
        Update: {
          creator_address?: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_source?: string | null
          market_cap_usd?: number | null
          snapshot_date?: string
          volume_24h_usd?: number | null
        }
        Relationships: []
      }
      creator_ethos_projection: {
        Row: {
          coin_address: string
          created_at: string | null
          creator_address: string
          ethos_level: string | null
          ethos_score: number | null
          ethos_score_source: string | null
          first_seen_date: string | null
          market_cap_usd: number | null
          refreshed_at: string
          score_updated_at: string | null
          twitter_username: string | null
          volume_24h_usd: number | null
          zora_handle: string | null
        }
        Insert: {
          coin_address: string
          created_at?: string | null
          creator_address: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_source?: string | null
          first_seen_date?: string | null
          market_cap_usd?: number | null
          refreshed_at?: string
          score_updated_at?: string | null
          twitter_username?: string | null
          volume_24h_usd?: number | null
          zora_handle?: string | null
        }
        Update: {
          coin_address?: string
          created_at?: string | null
          creator_address?: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_source?: string | null
          first_seen_date?: string | null
          market_cap_usd?: number | null
          refreshed_at?: string
          score_updated_at?: string | null
          twitter_username?: string | null
          volume_24h_usd?: number | null
          zora_handle?: string | null
        }
        Relationships: []
      }
      creator_infrastructure: {
        Row: {
          agent_type: string
          created_at: string
          creator_address: string
          csw_address: string | null
          last_processed_message_at: string | null
          listed_publicly: boolean
          privy_wallet_id: string | null
          updated_at: string
        }
        Insert: {
          agent_type?: string
          created_at?: string
          creator_address: string
          csw_address?: string | null
          last_processed_message_at?: string | null
          listed_publicly?: boolean
          privy_wallet_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          creator_address?: string
          csw_address?: string | null
          last_processed_message_at?: string | null
          listed_publicly?: boolean
          privy_wallet_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creator_meteora_alpha_vaults: {
        Row: {
          alpha_vault_program_id: string
          created_at: string
          creator_token: string
          deposit_accounts: Json
          enabled: boolean
          metadata: Json | null
          meteora_alpha_vault: string
          updated_at: string
        }
        Insert: {
          alpha_vault_program_id: string
          created_at?: string
          creator_token: string
          deposit_accounts: Json
          enabled?: boolean
          metadata?: Json | null
          meteora_alpha_vault: string
          updated_at?: string
        }
        Update: {
          alpha_vault_program_id?: string
          created_at?: string
          creator_token?: string
          deposit_accounts?: Json
          enabled?: boolean
          metadata?: Json | null
          meteora_alpha_vault?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_metrics_daily_snapshots: {
        Row: {
          creator_coins_fees_24h_usd: number | null
          creator_coins_market_cap_usd: number | null
          creator_coins_volume_24h_usd: number | null
          creators_total: number | null
          day: string
          updated_at: string
        }
        Insert: {
          creator_coins_fees_24h_usd?: number | null
          creator_coins_market_cap_usd?: number | null
          creator_coins_volume_24h_usd?: number | null
          creators_total?: number | null
          day: string
          updated_at?: string
        }
        Update: {
          creator_coins_fees_24h_usd?: number | null
          creator_coins_market_cap_usd?: number | null
          creator_coins_volume_24h_usd?: number | null
          creators_total?: number | null
          day?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_metrics_state: {
        Row: {
          backfill_complete: boolean
          cached_creators_total: number | null
          cached_fees_24h_usd: number | null
          cached_market_cap_usd: number | null
          cached_totals_at: string | null
          cached_volume_24h_usd: number | null
          checkpoint_block: number | null
          checkpoint_cursor: string | null
          checkpoint_log_index: number | null
          checkpoint_updated_at: string | null
          creators_reconciled_at: string | null
          drift_estimate_total: number | null
          drift_pct: number | null
          explore_backfill_complete: boolean
          explore_checkpoints_json: string | null
          explore_last_sync_at: string | null
          id: number
          last_drift_checked_at: string | null
          last_full_sync_at: string | null
          last_hot_refresh_at: string | null
          last_run_id: string | null
          last_sync_finished_at: string | null
          last_sync_started_at: string | null
          sampled_creators: number
          sync_error: string | null
          sync_error_count: number
          sync_status: string
        }
        Insert: {
          backfill_complete?: boolean
          cached_creators_total?: number | null
          cached_fees_24h_usd?: number | null
          cached_market_cap_usd?: number | null
          cached_totals_at?: string | null
          cached_volume_24h_usd?: number | null
          checkpoint_block?: number | null
          checkpoint_cursor?: string | null
          checkpoint_log_index?: number | null
          checkpoint_updated_at?: string | null
          creators_reconciled_at?: string | null
          drift_estimate_total?: number | null
          drift_pct?: number | null
          explore_backfill_complete?: boolean
          explore_checkpoints_json?: string | null
          explore_last_sync_at?: string | null
          id: number
          last_drift_checked_at?: string | null
          last_full_sync_at?: string | null
          last_hot_refresh_at?: string | null
          last_run_id?: string | null
          last_sync_finished_at?: string | null
          last_sync_started_at?: string | null
          sampled_creators?: number
          sync_error?: string | null
          sync_error_count?: number
          sync_status?: string
        }
        Update: {
          backfill_complete?: boolean
          cached_creators_total?: number | null
          cached_fees_24h_usd?: number | null
          cached_market_cap_usd?: number | null
          cached_totals_at?: string | null
          cached_volume_24h_usd?: number | null
          checkpoint_block?: number | null
          checkpoint_cursor?: string | null
          checkpoint_log_index?: number | null
          checkpoint_updated_at?: string | null
          creators_reconciled_at?: string | null
          drift_estimate_total?: number | null
          drift_pct?: number | null
          explore_backfill_complete?: boolean
          explore_checkpoints_json?: string | null
          explore_last_sync_at?: string | null
          id?: number
          last_drift_checked_at?: string | null
          last_full_sync_at?: string | null
          last_hot_refresh_at?: string | null
          last_run_id?: string | null
          last_sync_finished_at?: string | null
          last_sync_started_at?: string | null
          sampled_creators?: number
          sync_error?: string | null
          sync_error_count?: number
          sync_status?: string
        }
        Relationships: []
      }
      creator_strategy_features: {
        Row: {
          created_at: string
          creator_token: string
          failed_at: string | null
          failure_reason: string | null
          feature_key: string
          id: number
          metadata: Json
          payment_from: string | null
          payment_source: string
          payment_to: string | null
          payment_tx_hash: string | null
          payment_verified_at: string | null
          price_usdc_paid: number
          provisioned_at: string | null
          provisioner_ref: string | null
          refunded_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
          x402_authorization_nonce: string | null
        }
        Insert: {
          created_at?: string
          creator_token: string
          failed_at?: string | null
          failure_reason?: string | null
          feature_key: string
          id?: number
          metadata?: Json
          payment_from?: string | null
          payment_source?: string
          payment_to?: string | null
          payment_tx_hash?: string | null
          payment_verified_at?: string | null
          price_usdc_paid: number
          provisioned_at?: string | null
          provisioner_ref?: string | null
          refunded_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          x402_authorization_nonce?: string | null
        }
        Update: {
          created_at?: string
          creator_token?: string
          failed_at?: string | null
          failure_reason?: string | null
          feature_key?: string
          id?: number
          metadata?: Json
          payment_from?: string | null
          payment_source?: string
          payment_to?: string | null
          payment_tx_hash?: string | null
          payment_verified_at?: string | null
          price_usdc_paid?: number
          provisioned_at?: string | null
          provisioner_ref?: string | null
          refunded_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
          x402_authorization_nonce?: string | null
        }
        Relationships: []
      }
      creator_strategy_price_overrides: {
        Row: {
          created_at: string
          creator_token: string | null
          expires_at: string | null
          feature_key: string
          granted_by: string | null
          id: number
          price_usdc_override: number
          reason: string
          revoked_at: string | null
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          creator_token?: string | null
          expires_at?: string | null
          feature_key: string
          granted_by?: string | null
          id?: number
          price_usdc_override: number
          reason: string
          revoked_at?: string | null
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          creator_token?: string | null
          expires_at?: string | null
          feature_key?: string
          granted_by?: string | null
          id?: number
          price_usdc_override?: number
          reason?: string
          revoked_at?: string | null
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      creators: {
        Row: {
          coin_count: number
          creator_address: string
          first_seen_at: string | null
          last_seen_at: string
        }
        Insert: {
          coin_count?: number
          creator_address: string
          first_seen_at?: string | null
          last_seen_at?: string
        }
        Update: {
          coin_count?: number
          creator_address?: string
          first_seen_at?: string | null
          last_seen_at?: string
        }
        Relationships: []
      }
      deploys: {
        Row: {
          artifacts: Json
          attempt_count: number
          created_at: string
          current_stage: string | null
          deploy_token: string
          expires_at: string
          id: string
          last_error: string | null
          last_failure_code: string | null
          last_failure_stage: string | null
          last_tx_hash: string | null
          last_userop_hash: string | null
          lock_expires_at: string | null
          lock_owner: string | null
          next_run_after: string | null
          payload: Json
          session_address: string
          session_owner: string
          session_owner_key_enc: string | null
          session_signer: string | null
          session_signer_key_enc: string | null
          smart_wallet: string
          state: string | null
          step: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          artifacts?: Json
          attempt_count?: number
          created_at?: string
          current_stage?: string | null
          deploy_token: string
          expires_at: string
          id: string
          last_error?: string | null
          last_failure_code?: string | null
          last_failure_stage?: string | null
          last_tx_hash?: string | null
          last_userop_hash?: string | null
          lock_expires_at?: string | null
          lock_owner?: string | null
          next_run_after?: string | null
          payload: Json
          session_address: string
          session_owner: string
          session_owner_key_enc?: string | null
          session_signer?: string | null
          session_signer_key_enc?: string | null
          smart_wallet: string
          state?: string | null
          step?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          artifacts?: Json
          attempt_count?: number
          created_at?: string
          current_stage?: string | null
          deploy_token?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          last_failure_code?: string | null
          last_failure_stage?: string | null
          last_tx_hash?: string | null
          last_userop_hash?: string | null
          lock_expires_at?: string | null
          lock_owner?: string | null
          next_run_after?: string | null
          payload?: Json
          session_address?: string
          session_owner?: string
          session_owner_key_enc?: string | null
          session_signer?: string | null
          session_signer_key_enc?: string | null
          smart_wallet?: string
          state?: string | null
          step?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_labels_cache: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          expires_at: string
          is_known: boolean
          labels: Json
          source: string
        }
        Insert: {
          address: string
          chain_id?: number
          created_at?: string
          expires_at?: string
          is_known?: boolean
          labels?: Json
          source?: string
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          expires_at?: string
          is_known?: boolean
          labels?: Json
          source?: string
        }
        Relationships: []
      }
      episodic_summaries: {
        Row: {
          conversation_id: string
          last_updated: string
          summary: string
          version: number
        }
        Insert: {
          conversation_id: string
          last_updated?: string
          summary: string
          version?: number
        }
        Update: {
          conversation_id?: string
          last_updated?: string
          summary?: string
          version?: number
        }
        Relationships: []
      }
      ethos_score_sync_state: {
        Row: {
          cursor_after: string | null
          last_synced_at: string | null
          sync_key: string
          updated_at: string
        }
        Insert: {
          cursor_after?: string | null
          last_synced_at?: string | null
          sync_key: string
          updated_at?: string
        }
        Update: {
          cursor_after?: string | null
          last_synced_at?: string | null
          sync_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ethos_userkey_scores: {
        Row: {
          ethos_last_updated_at: string | null
          ethos_userkey: string
          fetched_at: string
          level: string | null
          raw: Json | null
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          ethos_last_updated_at?: string | null
          ethos_userkey: string
          fetched_at?: string
          level?: string | null
          raw?: Json | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          ethos_last_updated_at?: string | null
          ethos_userkey?: string
          fetched_at?: string
          level?: string | null
          raw?: Json | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fact_cards: {
        Row: {
          confidence: number | null
          conversation_id: string | null
          entity: string | null
          fact: string
          id: number
          source_turn_id: number | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          conversation_id?: string | null
          entity?: string | null
          fact: string
          id?: number
          source_turn_id?: number | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          conversation_id?: string | null
          entity?: string | null
          fact?: string
          id?: number
          source_turn_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      feedback_index: {
        Row: {
          agent_id: number
          client_address: string
          created_at: string
          endpoint: string | null
          feedback_hash: string | null
          feedback_index: number
          feedback_uri: string | null
          grove_uri: string | null
          id: number
          is_revoked: boolean
          reasoning: string | null
          tag1: string
          tag2: string
          updated_at: string
          value: number
          value_decimals: number
        }
        Insert: {
          agent_id: number
          client_address: string
          created_at?: string
          endpoint?: string | null
          feedback_hash?: string | null
          feedback_index: number
          feedback_uri?: string | null
          grove_uri?: string | null
          id?: number
          is_revoked?: boolean
          reasoning?: string | null
          tag1?: string
          tag2?: string
          updated_at?: string
          value: number
          value_decimals?: number
        }
        Update: {
          agent_id?: number
          client_address?: string
          created_at?: string
          endpoint?: string | null
          feedback_hash?: string | null
          feedback_index?: number
          feedback_uri?: string | null
          grove_uri?: string | null
          id?: number
          is_revoked?: boolean
          reasoning?: string | null
          tag1?: string
          tag2?: string
          updated_at?: string
          value?: number
          value_decimals?: number
        }
        Relationships: []
      }
      grove_chat_manifests: {
        Row: {
          chunk_list: Json
          conversation_id: string
          encryption_pubkey: string | null
          last_archived_at: string | null
          lens_profile_id: string | null
          root_hash: string
        }
        Insert: {
          chunk_list: Json
          conversation_id: string
          encryption_pubkey?: string | null
          last_archived_at?: string | null
          lens_profile_id?: string | null
          root_hash: string
        }
        Update: {
          chunk_list?: Json
          conversation_id?: string
          encryption_pubkey?: string | null
          last_archived_at?: string | null
          lens_profile_id?: string | null
          root_hash?: string
        }
        Relationships: []
      }
      image_generation_assets: {
        Row: {
          blob_pathname: string
          blob_url: string
          byte_size: number
          created_at: string
          filename: string | null
          id: string
          mime_type: string
          project_id: string
          role: string
        }
        Insert: {
          blob_pathname: string
          blob_url: string
          byte_size?: number
          created_at?: string
          filename?: string | null
          id: string
          mime_type: string
          project_id: string
          role: string
        }
        Update: {
          blob_pathname?: string
          blob_url?: string
          byte_size?: number
          created_at?: string
          filename?: string | null
          id?: string
          mime_type?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_generation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          evaluation_json: Json | null
          id: string
          job_id: string | null
          kind: string
          output_asset_id: string | null
          passed: boolean | null
          project_id: string
          prompt: string
          response_id: string | null
          revised_prompt: string | null
          score: number | null
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          evaluation_json?: Json | null
          id: string
          job_id?: string | null
          kind?: string
          output_asset_id?: string | null
          passed?: boolean | null
          project_id: string
          prompt: string
          response_id?: string | null
          revised_prompt?: string | null
          score?: number | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          evaluation_json?: Json | null
          id?: string
          job_id?: string | null
          kind?: string
          output_asset_id?: string | null
          passed?: boolean | null
          project_id?: string
          prompt?: string
          response_id?: string | null
          revised_prompt?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_attempts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_generation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          latest_error: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          project_id: string
          refine_instruction: string | null
          result_json: Json | null
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id: string
          kind?: string
          latest_error?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          project_id: string
          refine_instruction?: string | null
          result_json?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          latest_error?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          project_id?: string
          refine_instruction?: string | null
          result_json?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_generation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_projects: {
        Row: {
          brand_context_json: Json
          created_at: string
          creator_address: string | null
          id: string
          instruction: string
          last_response_id: string | null
          latest_error: string | null
          owner_address: string | null
          status: string
          style_preset: string | null
          updated_at: string
          vault_address: string | null
        }
        Insert: {
          brand_context_json?: Json
          created_at?: string
          creator_address?: string | null
          id: string
          instruction?: string
          last_response_id?: string | null
          latest_error?: string | null
          owner_address?: string | null
          status?: string
          style_preset?: string | null
          updated_at?: string
          vault_address?: string | null
        }
        Update: {
          brand_context_json?: Json
          created_at?: string
          creator_address?: string | null
          id?: string
          instruction?: string
          last_response_id?: string | null
          latest_error?: string | null
          owner_address?: string | null
          status?: string
          style_preset?: string | null
          updated_at?: string
          vault_address?: string | null
        }
        Relationships: []
      }
      keeper_jobs: {
        Row: {
          attempt_count: number
          claim_expires_at: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          dedupe_key: string | null
          id: number
          kind: string
          last_error: string | null
          max_attempts: number
          operation_id: string | null
          payload: Json
          priority: number
          result: Json | null
          run_at: string
          source: string
          stage_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          claim_expires_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: number
          kind: string
          last_error?: string | null
          max_attempts?: number
          operation_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          run_at?: string
          source?: string
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          claim_expires_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: number
          kind?: string
          last_error?: string | null
          max_attempts?: number
          operation_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          run_at?: string
          source?: string
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keeper_jobs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "control_plane_operations"
            referencedColumns: ["operation_id"]
          },
          {
            foreignKeyName: "keeper_jobs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "control_plane_stages"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      keepr_actions: {
        Row: {
          action: Json
          action_type: string | null
          attempt_count: number
          created_at: string
          dedupe_key: string | null
          executed_at: string | null
          group_id: string
          id: number
          last_error: string | null
          next_attempt_at: string | null
          status: string
          updated_at: string
          vault_address: string
        }
        Insert: {
          action: Json
          action_type?: string | null
          attempt_count?: number
          created_at?: string
          dedupe_key?: string | null
          executed_at?: string | null
          group_id: string
          id?: number
          last_error?: string | null
          next_attempt_at?: string | null
          status?: string
          updated_at?: string
          vault_address: string
        }
        Update: {
          action?: Json
          action_type?: string | null
          attempt_count?: number
          created_at?: string
          dedupe_key?: string | null
          executed_at?: string | null
          group_id?: string
          id?: number
          last_error?: string | null
          next_attempt_at?: string | null
          status?: string
          updated_at?: string
          vault_address?: string
        }
        Relationships: []
      }
      keepr_join_requests: {
        Row: {
          action_id: number | null
          created_at: string
          group_id: string
          id: number
          last_checked_at: string | null
          last_reason: string | null
          next_check_at: string | null
          status: string
          updated_at: string
          vault_address: string
          wallet_address: string
        }
        Insert: {
          action_id?: number | null
          created_at?: string
          group_id: string
          id?: number
          last_checked_at?: string | null
          last_reason?: string | null
          next_check_at?: string | null
          status?: string
          updated_at?: string
          vault_address: string
          wallet_address: string
        }
        Update: {
          action_id?: number | null
          created_at?: string
          group_id?: string
          id?: number
          last_checked_at?: string | null
          last_reason?: string | null
          next_check_at?: string | null
          status?: string
          updated_at?: string
          vault_address?: string
          wallet_address?: string
        }
        Relationships: []
      }
      keepr_logs: {
        Row: {
          actor_wallet: string | null
          created_at: string
          details: Json
          event_type: string
          id: number
          vault_address: string
        }
        Insert: {
          actor_wallet?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: number
          vault_address: string
        }
        Update: {
          actor_wallet?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: number
          vault_address?: string
        }
        Relationships: []
      }
      keepr_nonces: {
        Row: {
          expires_at: string
          issued_at: string
          nonce: string
          purpose: string
          used_at: string | null
          vault_address: string
          wallet_address: string
        }
        Insert: {
          expires_at: string
          issued_at?: string
          nonce: string
          purpose: string
          used_at?: string | null
          vault_address: string
          wallet_address: string
        }
        Update: {
          expires_at?: string
          issued_at?: string
          nonce?: string
          purpose?: string
          used_at?: string | null
          vault_address?: string
          wallet_address?: string
        }
        Relationships: []
      }
      keepr_vault_automation: {
        Row: {
          authorization_source: string
          automation_enabled: boolean
          automation_scope: string
          canonical_csw_address: string
          created_at: string
          embedded_eoa_address: string | null
          last_owner_check_at: string | null
          metadata: Json
          privy_wallet_id: string | null
          profile_id: number
          revoked_at: string | null
          updated_at: string
          vault_address: string
        }
        Insert: {
          authorization_source: string
          automation_enabled?: boolean
          automation_scope: string
          canonical_csw_address: string
          created_at?: string
          embedded_eoa_address?: string | null
          last_owner_check_at?: string | null
          metadata?: Json
          privy_wallet_id?: string | null
          profile_id: number
          revoked_at?: string | null
          updated_at?: string
          vault_address: string
        }
        Update: {
          authorization_source?: string
          automation_enabled?: boolean
          automation_scope?: string
          canonical_csw_address?: string
          created_at?: string
          embedded_eoa_address?: string | null
          last_owner_check_at?: string | null
          metadata?: Json
          privy_wallet_id?: string | null
          profile_id?: number
          revoked_at?: string | null
          updated_at?: string
          vault_address?: string
        }
        Relationships: []
      }
      keepr_vaults: {
        Row: {
          canonical_owner_address: string
          chain_id: number
          config_hash: string
          config_json: Json
          config_version: number
          created_at: string
          creator_coin_address: string
          fail_closed: boolean
          gating_enabled: boolean
          gating_mode: string
          graduated_at: string | null
          group_id: string
          join_locked: boolean
          last_sync_at: string | null
          lens_group_address: string | null
          min_shares: string | null
          settled_at: string | null
          settlement_stage: string | null
          settlement_stage_updated_at: string | null
          share_token_address: string | null
          updated_at: string
          vault_address: string
        }
        Insert: {
          canonical_owner_address: string
          chain_id: number
          config_hash: string
          config_json: Json
          config_version?: number
          created_at?: string
          creator_coin_address: string
          fail_closed?: boolean
          gating_enabled?: boolean
          gating_mode?: string
          graduated_at?: string | null
          group_id: string
          join_locked?: boolean
          last_sync_at?: string | null
          lens_group_address?: string | null
          min_shares?: string | null
          settled_at?: string | null
          settlement_stage?: string | null
          settlement_stage_updated_at?: string | null
          share_token_address?: string | null
          updated_at?: string
          vault_address: string
        }
        Update: {
          canonical_owner_address?: string
          chain_id?: number
          config_hash?: string
          config_json?: Json
          config_version?: number
          created_at?: string
          creator_coin_address?: string
          fail_closed?: boolean
          gating_enabled?: boolean
          gating_mode?: string
          graduated_at?: string | null
          group_id?: string
          join_locked?: boolean
          last_sync_at?: string | null
          lens_group_address?: string | null
          min_shares?: string | null
          settled_at?: string | null
          settlement_stage?: string | null
          settlement_stage_updated_at?: string | null
          share_token_address?: string | null
          updated_at?: string
          vault_address?: string
        }
        Relationships: []
      }
      keepr_workflow_checkpoints: {
        Row: {
          action: string
          checkpoint_key: string
          created_at: string
          payload_json: Json | null
          response_json: Json | null
          status: string
          updated_at: string
          workflow: string
        }
        Insert: {
          action: string
          checkpoint_key: string
          created_at?: string
          payload_json?: Json | null
          response_json?: Json | null
          status: string
          updated_at?: string
          workflow: string
        }
        Update: {
          action?: string
          checkpoint_key?: string
          created_at?: string
          payload_json?: Json | null
          response_json?: Json | null
          status?: string
          updated_at?: string
          workflow?: string
        }
        Relationships: []
      }
      lottery_amoe_daily_twitter_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          tweet_author_id: string | null
          tweet_author_username: string | null
          tweet_id: string | null
          tweet_url: string | null
          wallet_address: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          tweet_author_id?: string | null
          tweet_author_username?: string | null
          tweet_id?: string | null
          tweet_url?: string | null
          wallet_address: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          tweet_author_id?: string | null
          tweet_author_username?: string | null
          tweet_id?: string | null
          tweet_url?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      lottery_amoe_daily_xmtp_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          message_id: string | null
          recipient_address: string | null
          wallet_address: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          message_id?: string | null
          recipient_address?: string | null
          wallet_address: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          message_id?: string | null
          recipient_address?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      lottery_amoe_entries: {
        Row: {
          attestation_deadline: number
          created_at: string
          creator_coin: string
          id: number
          nonce: string
          nonce_hash: string
          status: string
          wallet_address: string
        }
        Insert: {
          attestation_deadline: number
          created_at?: string
          creator_coin: string
          id?: number
          nonce: string
          nonce_hash: string
          status?: string
          wallet_address: string
        }
        Update: {
          attestation_deadline?: number
          created_at?: string
          creator_coin?: string
          id?: number
          nonce?: string
          nonce_hash?: string
          status?: string
          wallet_address?: string
        }
        Relationships: []
      }
      lottery_amoe_nonces: {
        Row: {
          consumed_at: string | null
          creator_coin: string
          expires_at: string
          issued_at: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          consumed_at?: string | null
          creator_coin: string
          expires_at: string
          issued_at?: string
          nonce: string
          wallet_address: string
        }
        Update: {
          consumed_at?: string | null
          creator_coin?: string
          expires_at?: string
          issued_at?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: []
      }
      memory_snapshots: {
        Row: {
          conversation_id: string
          snapshot_json: Json
          updated_at: string
        }
        Insert: {
          conversation_id: string
          snapshot_json: Json
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          snapshot_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          currency: string | null
          event_type: string
          id: number
          order_id: string | null
          payload_hash: string | null
          payload_json: Json | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          amount?: number | null
          currency?: string | null
          event_type: string
          id?: number
          order_id?: string | null
          payload_hash?: string | null
          payload_json?: Json | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          amount?: number | null
          currency?: string | null
          event_type?: string
          id?: number
          order_id?: string | null
          payload_hash?: string | null
          payload_json?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: number
          metadata_json: Json
          order_id: string
          policy_version: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: number
          metadata_json?: Json
          order_id: string
          policy_version?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: number
          metadata_json?: Json
          order_id?: string
          policy_version?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      points: {
        Row: {
          amount: number
          created_at: string
          id: number
          signup_id: number
          source: string
          source_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          signup_id: number
          source: string
          source_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          signup_id?: number
          source?: string
          source_id?: string | null
        }
        Relationships: []
      }
      privy_user_aliases: {
        Row: {
          created_at: string
          privy_user_id: string
          profile_id: number
          source: string
        }
        Insert: {
          created_at?: string
          privy_user_id: string
          profile_id: number
          source?: string
        }
        Update: {
          created_at?: string
          privy_user_id?: string
          profile_id?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "privy_user_aliases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privy_user_aliases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      profile_wallets: {
        Row: {
          address: string
          canonical_csw_address: string | null
          canonical_source: string
          canonical_zora_csw_address: string | null
          chain: string
          chain_id: number
          created_at: string
          is_canonical_smart_wallet: boolean
          is_canonical_solana_wallet: boolean
          is_embedded_eoa: boolean
          is_operational_solana_wallet: boolean
          is_primary: boolean
          last_checked_at: string | null
          metadata: Json | null
          privy_embedded_eoa_address: string | null
          privy_is_owner: boolean
          profile_id: number
          provider: string
          updated_at: string
          verified_at: string | null
          wallet_type: string
        }
        Insert: {
          address: string
          canonical_csw_address?: string | null
          canonical_source?: string
          canonical_zora_csw_address?: string | null
          chain?: string
          chain_id?: number
          created_at?: string
          is_canonical_smart_wallet?: boolean
          is_canonical_solana_wallet?: boolean
          is_embedded_eoa?: boolean
          is_operational_solana_wallet?: boolean
          is_primary?: boolean
          last_checked_at?: string | null
          metadata?: Json | null
          privy_embedded_eoa_address?: string | null
          privy_is_owner?: boolean
          profile_id: number
          provider?: string
          updated_at?: string
          verified_at?: string | null
          wallet_type?: string
        }
        Update: {
          address?: string
          canonical_csw_address?: string | null
          canonical_source?: string
          canonical_zora_csw_address?: string | null
          chain?: string
          chain_id?: number
          created_at?: string
          is_canonical_smart_wallet?: boolean
          is_canonical_solana_wallet?: boolean
          is_embedded_eoa?: boolean
          is_operational_solana_wallet?: boolean
          is_primary?: boolean
          last_checked_at?: string | null
          metadata?: Json | null
          privy_embedded_eoa_address?: string | null
          privy_is_owner?: boolean
          profile_id?: number
          provider?: string
          updated_at?: string
          verified_at?: string | null
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_access_decided_at: string | null
          app_access_decided_by: string | null
          app_access_decision_note: string | null
          app_access_status: string
          avatar_url: string | null
          banner_url: string | null
          base_sub_account: string | null
          bio: string | null
          border_tier: number
          contact_preference: string | null
          created_at: string
          csw_address: string | null
          display_name: string | null
          email: string | null
          email_verified: boolean
          embedded_wallet: string | null
          embedded_wallet_chain: string | null
          embedded_wallet_client_type: string | null
          erc8004_agent_id: number | null
          erc8128_agent_id: string | null
          farcaster_fid: number | null
          has_creator_coin: boolean | null
          id: number
          lens_account_address: string | null
          lens_grove_uri: string | null
          lens_handle: string | null
          lens_owner_address: string | null
          merged_into_profile_id: number | null
          persona: string | null
          preprov_coin_address: string | null
          preprov_coin_symbol: string | null
          preprov_farcaster_pfp: string | null
          preprov_farcaster_username: string | null
          preprov_server_wallet_address: string | null
          preprov_server_wallet_id: string | null
          preprov_zora_handle: string | null
          preprovisioned_at: string | null
          primary_embedded_eoa: string | null
          primary_wallet: string | null
          privy_user_id: string | null
          profile_completed_at: string | null
          profile_fields: Json | null
          referral_claimed_at: string | null
          referral_code: string | null
          referred_by_code: string | null
          referred_by_signup_id: number | null
          updated_at: string
          verifications: Json | null
          website: string | null
          x_follow_verified_at: string | null
        }
        Insert: {
          app_access_decided_at?: string | null
          app_access_decided_by?: string | null
          app_access_decision_note?: string | null
          app_access_status?: string
          avatar_url?: string | null
          banner_url?: string | null
          base_sub_account?: string | null
          bio?: string | null
          border_tier?: number
          contact_preference?: string | null
          created_at?: string
          csw_address?: string | null
          display_name?: string | null
          email?: string | null
          email_verified?: boolean
          embedded_wallet?: string | null
          embedded_wallet_chain?: string | null
          embedded_wallet_client_type?: string | null
          erc8004_agent_id?: number | null
          erc8128_agent_id?: string | null
          farcaster_fid?: number | null
          has_creator_coin?: boolean | null
          id?: number
          lens_account_address?: string | null
          lens_grove_uri?: string | null
          lens_handle?: string | null
          lens_owner_address?: string | null
          merged_into_profile_id?: number | null
          persona?: string | null
          preprov_coin_address?: string | null
          preprov_coin_symbol?: string | null
          preprov_farcaster_pfp?: string | null
          preprov_farcaster_username?: string | null
          preprov_server_wallet_address?: string | null
          preprov_server_wallet_id?: string | null
          preprov_zora_handle?: string | null
          preprovisioned_at?: string | null
          primary_embedded_eoa?: string | null
          primary_wallet?: string | null
          privy_user_id?: string | null
          profile_completed_at?: string | null
          profile_fields?: Json | null
          referral_claimed_at?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          referred_by_signup_id?: number | null
          updated_at?: string
          verifications?: Json | null
          website?: string | null
          x_follow_verified_at?: string | null
        }
        Update: {
          app_access_decided_at?: string | null
          app_access_decided_by?: string | null
          app_access_decision_note?: string | null
          app_access_status?: string
          avatar_url?: string | null
          banner_url?: string | null
          base_sub_account?: string | null
          bio?: string | null
          border_tier?: number
          contact_preference?: string | null
          created_at?: string
          csw_address?: string | null
          display_name?: string | null
          email?: string | null
          email_verified?: boolean
          embedded_wallet?: string | null
          embedded_wallet_chain?: string | null
          embedded_wallet_client_type?: string | null
          erc8004_agent_id?: number | null
          erc8128_agent_id?: string | null
          farcaster_fid?: number | null
          has_creator_coin?: boolean | null
          id?: number
          lens_account_address?: string | null
          lens_grove_uri?: string | null
          lens_handle?: string | null
          lens_owner_address?: string | null
          merged_into_profile_id?: number | null
          persona?: string | null
          preprov_coin_address?: string | null
          preprov_coin_symbol?: string | null
          preprov_farcaster_pfp?: string | null
          preprov_farcaster_username?: string | null
          preprov_server_wallet_address?: string | null
          preprov_server_wallet_id?: string | null
          preprov_zora_handle?: string | null
          preprovisioned_at?: string | null
          primary_embedded_eoa?: string | null
          primary_wallet?: string | null
          privy_user_id?: string | null
          profile_completed_at?: string | null
          profile_fields?: Json | null
          referral_claimed_at?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          referred_by_signup_id?: number | null
          updated_at?: string
          verifications?: Json | null
          website?: string | null
          x_follow_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_merged_into_profile_id_fkey"
            columns: ["merged_into_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_merged_into_profile_id_fkey"
            columns: ["merged_into_profile_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      referral_conversions: {
        Row: {
          attribution: string
          created_at: string
          id: number
          invalid_reason: string | null
          invitee_signup_id: number
          ip_hash: string | null
          is_valid: boolean
          qualified_at: string | null
          referral_code: string
          referrer_signup_id: number
          session_id: string | null
          status: string | null
          ua_hash: string | null
        }
        Insert: {
          attribution?: string
          created_at?: string
          id?: number
          invalid_reason?: string | null
          invitee_signup_id: number
          ip_hash?: string | null
          is_valid?: boolean
          qualified_at?: string | null
          referral_code: string
          referrer_signup_id: number
          session_id?: string | null
          status?: string | null
          ua_hash?: string | null
        }
        Update: {
          attribution?: string
          created_at?: string
          id?: number
          invalid_reason?: string | null
          invitee_signup_id?: number
          ip_hash?: string | null
          is_valid?: boolean
          qualified_at?: string | null
          referral_code?: string
          referrer_signup_id?: number
          session_id?: string | null
          status?: string | null
          ua_hash?: string | null
        }
        Relationships: []
      }
      schema_bootstrap_ledger: {
        Row: {
          applied_at: string
          filename: string
        }
        Insert: {
          applied_at?: string
          filename: string
        }
        Update: {
          applied_at?: string
          filename?: string
        }
        Relationships: []
      }
      solana_creator_relay_config: {
        Row: {
          b2_verified_at: string | null
          created_at: string
          creator_token: string
          id: number
          last_error: string | null
          readiness_checks_json: Json | null
          readiness_status: string
          relay_enabled: boolean
          relay_enabled_at: string | null
          share_mesh_mint: string
          share_oft: string
          source_session_id: string | null
          updated_at: string
        }
        Insert: {
          b2_verified_at?: string | null
          created_at?: string
          creator_token: string
          id?: number
          last_error?: string | null
          readiness_checks_json?: Json | null
          readiness_status?: string
          relay_enabled?: boolean
          relay_enabled_at?: string | null
          share_mesh_mint: string
          share_oft: string
          source_session_id?: string | null
          updated_at?: string
        }
        Update: {
          b2_verified_at?: string | null
          created_at?: string
          creator_token?: string
          id?: number
          last_error?: string | null
          readiness_checks_json?: Json | null
          readiness_status?: string
          relay_enabled?: boolean
          relay_enabled_at?: string | null
          share_mesh_mint?: string
          share_oft?: string
          source_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solana_hook_status: {
        Row: {
          created_at: string
          creator_config: string | null
          creator_token: string
          hook_mint: string | null
          id: number
          last_error: string | null
          pending_entries: string | null
          provision_attempt_count: number
          response_json: Json | null
          share_oft: string | null
          source_session_id: string | null
          status: string
          updated_at: string
          winner_record: string | null
        }
        Insert: {
          created_at?: string
          creator_config?: string | null
          creator_token: string
          hook_mint?: string | null
          id?: number
          last_error?: string | null
          pending_entries?: string | null
          provision_attempt_count?: number
          response_json?: Json | null
          share_oft?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          winner_record?: string | null
        }
        Update: {
          created_at?: string
          creator_config?: string | null
          creator_token?: string
          hook_mint?: string | null
          id?: number
          last_error?: string | null
          pending_entries?: string | null
          provision_attempt_count?: number
          response_json?: Json | null
          share_oft?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
          winner_record?: string | null
        }
        Relationships: []
      }
      solana_meteora_pool_status: {
        Row: {
          created_at: string
          creator_token: string
          id: number
          last_error: string | null
          last_signature: string | null
          pool_address: string | null
          provision_attempt_count: number
          quote_mint: string
          response_json: Json | null
          share_mesh_mint: string
          share_oft: string | null
          source_session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_token: string
          id?: number
          last_error?: string | null
          last_signature?: string | null
          pool_address?: string | null
          provision_attempt_count?: number
          quote_mint?: string
          response_json?: Json | null
          share_mesh_mint: string
          share_oft?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_token?: string
          id?: number
          last_error?: string | null
          last_signature?: string | null
          pool_address?: string | null
          provision_attempt_count?: number
          quote_mint?: string
          response_json?: Json | null
          share_mesh_mint?: string
          share_oft?: string | null
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      solana_share_mesh_mappings: {
        Row: {
          applied_at: string | null
          apply_attempt_count: number
          created_at: string
          creator_token: string
          id: number
          last_error: string | null
          share_mesh_mint: string
          share_oft: string
          source_session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          apply_attempt_count?: number
          created_at?: string
          creator_token: string
          id?: number
          last_error?: string | null
          share_mesh_mint: string
          share_oft: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          apply_attempt_count?: number
          created_at?: string
          creator_token?: string
          id?: number
          last_error?: string | null
          share_mesh_mint?: string
          share_oft?: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      solana_sweep_jobs: {
        Row: {
          attempt_count: number
          canonical_wallet: string
          created_at: string
          id: number
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          min_lamports: number
          next_retry_at: string | null
          operational_wallet: string
          profile_id: number
          status: string
          tx_sig: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          canonical_wallet: string
          created_at?: string
          id?: number
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          min_lamports?: number
          next_retry_at?: string | null
          operational_wallet: string
          profile_id: number
          status?: string
          tx_sig?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          canonical_wallet?: string
          created_at?: string
          id?: number
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          min_lamports?: number
          next_retry_at?: string | null
          operational_wallet?: string
          profile_id?: number
          status?: string
          tx_sig?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solana_sweep_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solana_sweep_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      task_loops: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: number
          status: string | null
          task: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: number
          status?: string | null
          task: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: number
          status?: string | null
          task?: string
        }
        Relationships: []
      }
      telegram_action_audit: {
        Row: {
          action_type: string
          canonical_csw_address: string
          chat_id: string
          correlation_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          execution_json: Json | null
          id: string
          intent_json: Json
          message_id: number | null
          profile_id: number
          quote_json: Json | null
          status: string
          telegram_user_id: number
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          canonical_csw_address: string
          chat_id: string
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_json?: Json | null
          id?: string
          intent_json: Json
          message_id?: number | null
          profile_id: number
          quote_json?: Json | null
          status: string
          telegram_user_id: number
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          canonical_csw_address?: string
          chat_id?: string
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_json?: Json | null
          id?: string
          intent_json?: Json
          message_id?: number | null
          profile_id?: number
          quote_json?: Json | null
          status?: string
          telegram_user_id?: number
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_action_tokens: {
        Row: {
          action_type: string
          chat_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          intent_payload_json: Json
          telegram_user_id: number
          token_hash: string
        }
        Insert: {
          action_type: string
          chat_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          intent_payload_json: Json
          telegram_user_id: number
          token_hash: string
        }
        Update: {
          action_type?: string
          chat_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          intent_payload_json?: Json
          telegram_user_id?: number
          token_hash?: string
        }
        Relationships: []
      }
      telegram_active_messages: {
        Row: {
          chat_id: string
          created_at: string
          message_id: number
          owner_telegram_user_id: number
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          message_id: number
          owner_telegram_user_id: number
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          message_id?: number
          owner_telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_chat_vault_scope: {
        Row: {
          allowed_vault_ids: Json
          bid_enabled: boolean
          buy_sell_enabled: boolean
          chat_id: string
        }
        Insert: {
          allowed_vault_ids?: Json
          bid_enabled?: boolean
          buy_sell_enabled?: boolean
          chat_id: string
        }
        Update: {
          allowed_vault_ids?: Json
          bid_enabled?: boolean
          buy_sell_enabled?: boolean
          chat_id?: string
        }
        Relationships: []
      }
      telegram_funnel_events: {
        Row: {
          action_type: string | null
          chat_id: string | null
          context_json: Json
          created_at: string
          event_name: string
          id: string
          telegram_user_id: number | null
        }
        Insert: {
          action_type?: string | null
          chat_id?: string | null
          context_json?: Json
          created_at?: string
          event_name: string
          id?: string
          telegram_user_id?: number | null
        }
        Update: {
          action_type?: string | null
          chat_id?: string | null
          context_json?: Json
          created_at?: string
          event_name?: string
          id?: string
          telegram_user_id?: number | null
        }
        Relationships: []
      }
      telegram_holder_room_members: {
        Row: {
          canonical_csw_address: string
          created_at: string
          grace_until: string | null
          last_checked_at: string | null
          last_eligible_at: string | null
          removed_at: string | null
          room_chat_id: string
          status: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          canonical_csw_address: string
          created_at?: string
          grace_until?: string | null
          last_checked_at?: string | null
          last_eligible_at?: string | null
          removed_at?: string | null
          room_chat_id: string
          status?: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          canonical_csw_address?: string
          created_at?: string
          grace_until?: string | null
          last_checked_at?: string | null
          last_eligible_at?: string | null
          removed_at?: string | null
          room_chat_id?: string
          status?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_holder_room_policies: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          grace_hours: number
          min_shares_raw: string
          room_chat_id: string
          updated_at: string
          vault_address: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          grace_hours?: number
          min_shares_raw: string
          room_chat_id: string
          updated_at?: string
          vault_address: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          grace_hours?: number
          min_shares_raw?: string
          room_chat_id?: string
          updated_at?: string
          vault_address?: string
        }
        Relationships: []
      }
      telegram_inline_signal_feeds: {
        Row: {
          closed_at: string | null
          created_at: string
          inline_message_id: string
          last_pushed_at: string | null
          last_render_hash: string | null
          owner_telegram_user_id: number
          paused: boolean
          source_chat_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          inline_message_id: string
          last_pushed_at?: string | null
          last_render_hash?: string | null
          owner_telegram_user_id: number
          paused?: boolean
          source_chat_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          inline_message_id?: string
          last_pushed_at?: string | null
          last_render_hash?: string | null
          owner_telegram_user_id?: number
          paused?: boolean
          source_chat_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_start_token_claims: {
        Row: {
          chat_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          privy_user_id: string
          telegram_user_id: number
          token_hash: string
        }
        Insert: {
          chat_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          privy_user_id: string
          telegram_user_id: number
          token_hash: string
        }
        Update: {
          chat_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          privy_user_id?: string
          telegram_user_id?: number
          token_hash?: string
        }
        Relationships: []
      }
      telegram_link_telemetry_events: {
        Row: {
          chat_id: string | null
          created_at: string
          event: string
          flow_id: string | null
          id: number
          payload: Json | null
          phase: string | null
          privy_user_id: string | null
          source: string | null
          status: string | null
          telegram_user_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          event: string
          flow_id?: string | null
          id?: number
          payload?: Json | null
          phase?: string | null
          privy_user_id?: string | null
          source?: string | null
          status?: string | null
          telegram_user_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          event?: string
          flow_id?: string | null
          id?: number
          payload?: Json | null
          phase?: string | null
          privy_user_id?: string | null
          source?: string | null
          status?: string | null
          telegram_user_id?: string | null
        }
        Relationships: []
      }
      telegram_miniapp_replay_nonces: {
        Row: {
          auth_date: number
          created_at: string
          expires_at: string
          init_data_hash: string
          telegram_user_id: number
        }
        Insert: {
          auth_date: number
          created_at?: string
          expires_at: string
          init_data_hash: string
          telegram_user_id: number
        }
        Update: {
          auth_date?: number
          created_at?: string
          expires_at?: string
          init_data_hash?: string
          telegram_user_id?: number
        }
        Relationships: []
      }
      telegram_miniapp_sessions: {
        Row: {
          auth_date: number
          chat_id: string | null
          chat_instance: string | null
          chat_type: string | null
          created_at: string
          expires_at: string
          init_data_hash: string
          last_used_at: string | null
          revoked_at: string | null
          telegram_user_id: number
          telegram_username: string | null
          token_hash: string
        }
        Insert: {
          auth_date: number
          chat_id?: string | null
          chat_instance?: string | null
          chat_type?: string | null
          created_at?: string
          expires_at: string
          init_data_hash: string
          last_used_at?: string | null
          revoked_at?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          token_hash: string
        }
        Update: {
          auth_date?: number
          chat_id?: string | null
          chat_instance?: string | null
          chat_type?: string | null
          created_at?: string
          expires_at?: string
          init_data_hash?: string
          last_used_at?: string | null
          revoked_at?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      telegram_onboarding_sessions: {
        Row: {
          expires_at: string
          step: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          expires_at: string
          step: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          expires_at?: string
          step?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_private_dm_welcome_sent: {
        Row: {
          sent_at: string
          telegram_user_id: number
        }
        Insert: {
          sent_at?: string
          telegram_user_id: number
        }
        Update: {
          sent_at?: string
          telegram_user_id?: number
        }
        Relationships: []
      }
      telegram_trade_percent_prompts: {
        Row: {
          action_type: string
          chat_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          telegram_user_id: number
          updated_at: string
          vault_address: string
        }
        Insert: {
          action_type: string
          chat_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          telegram_user_id: number
          updated_at?: string
          vault_address: string
        }
        Update: {
          action_type?: string
          chat_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          telegram_user_id?: number
          updated_at?: string
          vault_address?: string
        }
        Relationships: []
      }
      telegram_user_links: {
        Row: {
          canonical_csw_address: string | null
          failure_count: number
          last_failure_reason: string | null
          last_used_at: string | null
          last_verified_at: string | null
          link_status: string
          linked_at: string
          owner_verified: boolean
          privy_user_id: string
          profile_id: number
          revoked_at: string | null
          telegram_user_id: number
          telegram_username: string | null
          unlink_requested_at: string | null
        }
        Insert: {
          canonical_csw_address?: string | null
          failure_count?: number
          last_failure_reason?: string | null
          last_used_at?: string | null
          last_verified_at?: string | null
          link_status?: string
          linked_at?: string
          owner_verified?: boolean
          privy_user_id: string
          profile_id: number
          revoked_at?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          unlink_requested_at?: string | null
        }
        Update: {
          canonical_csw_address?: string | null
          failure_count?: number
          last_failure_reason?: string | null
          last_used_at?: string | null
          last_verified_at?: string | null
          link_status?: string
          linked_at?: string
          owner_verified?: boolean
          privy_user_id?: string
          profile_id?: number
          revoked_at?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          unlink_requested_at?: string | null
        }
        Relationships: []
      }
      user_ethos_identity_keys: {
        Row: {
          canonical_user_id: number
          created_at: string
          ethos_userkey: string
          identity_type: string
          priority: number
          source: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          canonical_user_id: number
          created_at?: string
          ethos_userkey: string
          identity_type: string
          priority: number
          source?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          canonical_user_id?: number
          created_at?: string
          ethos_userkey?: string
          identity_type?: string
          priority?: number
          source?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_ethos_identity_keys_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ethos_identity_keys_canonical_user_id_fkey"
            columns: ["canonical_user_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_directory"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          first_touch: Json
          id: string
          ip_country: string | null
          ip_hash: string | null
          referrer: string | null
          role: string
          session_id: string | null
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
          x_handle: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          first_touch?: Json
          id?: string
          ip_country?: string | null
          ip_hash?: string | null
          referrer?: string | null
          role: string
          session_id?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
          x_handle?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          first_touch?: Json
          id?: string
          ip_country?: string | null
          ip_hash?: string | null
          referrer?: string | null
          role?: string
          session_id?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
          x_handle?: string | null
        }
        Relationships: []
      }
      wallet_directory: {
        Row: {
          avatar_url: string | null
          canonical_wallet: string
          created_at: string
          display_name: string | null
          ethos_level: string | null
          ethos_profile_id: number | null
          ethos_score: number | null
          ethos_score_updated_at: string | null
          ethos_userkey: string | null
          last_seen_at: string | null
          updated_at: string
          xmtp_address: string | null
          xmtp_inbox_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          canonical_wallet: string
          created_at?: string
          display_name?: string | null
          ethos_level?: string | null
          ethos_profile_id?: number | null
          ethos_score?: number | null
          ethos_score_updated_at?: string | null
          ethos_userkey?: string | null
          last_seen_at?: string | null
          updated_at?: string
          xmtp_address?: string | null
          xmtp_inbox_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          canonical_wallet?: string
          created_at?: string
          display_name?: string | null
          ethos_level?: string | null
          ethos_profile_id?: number | null
          ethos_score?: number | null
          ethos_score_updated_at?: string | null
          ethos_userkey?: string | null
          last_seen_at?: string | null
          updated_at?: string
          xmtp_address?: string | null
          xmtp_inbox_id?: string | null
        }
        Relationships: []
      }
      wallet_intelligence_cache: {
        Row: {
          address: string
          chain_ids: string
          created_at: string
          expires_at: string
          graph: Json
          grove_uri: string | null
          hops: number
        }
        Insert: {
          address: string
          chain_ids?: string
          created_at?: string
          expires_at?: string
          graph: Json
          grove_uri?: string | null
          hops?: number
        }
        Update: {
          address?: string
          chain_ids?: string
          created_at?: string
          expires_at?: string
          graph?: Json
          grove_uri?: string | null
          hops?: number
        }
        Relationships: []
      }
      website_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          path: string
          props: Json
          referrer: string | null
          session_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          path: string
          props?: Json
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          path?: string
          props?: Json
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      zora_coin_holders: {
        Row: {
          balance_raw: number
          coin_address: string
          holder_address: string
          holder_code_size: number | null
          holder_contract_kind: string | null
          holder_flagged_at: string | null
          holder_is_contract: boolean | null
          owner_avatar_url: string | null
          owner_handle: string | null
          owner_is_profile: boolean
          rank_in_coin: number | null
          raw_node: Json | null
          synced_at: string
        }
        Insert: {
          balance_raw: number
          coin_address: string
          holder_address: string
          holder_code_size?: number | null
          holder_contract_kind?: string | null
          holder_flagged_at?: string | null
          holder_is_contract?: boolean | null
          owner_avatar_url?: string | null
          owner_handle?: string | null
          owner_is_profile?: boolean
          rank_in_coin?: number | null
          raw_node?: Json | null
          synced_at?: string
        }
        Update: {
          balance_raw?: number
          coin_address?: string
          holder_address?: string
          holder_code_size?: number | null
          holder_contract_kind?: string | null
          holder_flagged_at?: string | null
          holder_is_contract?: boolean | null
          owner_avatar_url?: string | null
          owner_handle?: string | null
          owner_is_profile?: boolean
          rank_in_coin?: number | null
          raw_node?: Json | null
          synced_at?: string
        }
        Relationships: []
      }
      zora_csw_owner_class: {
        Row: {
          base_nonce: number | null
          basename: string | null
          basename_avatar: string | null
          ens_avatar: string | null
          ens_name: string | null
          eoa: string
          ethos_level: string | null
          ethos_score: number | null
          ethos_score_updated_at: string | null
          ethos_userkey: string | null
          farcaster_display_name: string | null
          farcaster_fid: number | null
          farcaster_username: string | null
          first_classified_at: string
          last_updated_at: string
          mainnet_nonce: number | null
          metadata: Json
          names_synced_at: string | null
          wallet_class: string
          zora_creator_coin_address: string | null
          zora_display_name: string | null
          zora_handle: string | null
          zora_synced_at: string | null
        }
        Insert: {
          base_nonce?: number | null
          basename?: string | null
          basename_avatar?: string | null
          ens_avatar?: string | null
          ens_name?: string | null
          eoa: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_updated_at?: string | null
          ethos_userkey?: string | null
          farcaster_display_name?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          first_classified_at?: string
          last_updated_at?: string
          mainnet_nonce?: number | null
          metadata?: Json
          names_synced_at?: string | null
          wallet_class: string
          zora_creator_coin_address?: string | null
          zora_display_name?: string | null
          zora_handle?: string | null
          zora_synced_at?: string | null
        }
        Update: {
          base_nonce?: number | null
          basename?: string | null
          basename_avatar?: string | null
          ens_avatar?: string | null
          ens_name?: string | null
          eoa?: string
          ethos_level?: string | null
          ethos_score?: number | null
          ethos_score_updated_at?: string | null
          ethos_userkey?: string | null
          farcaster_display_name?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          first_classified_at?: string
          last_updated_at?: string
          mainnet_nonce?: number | null
          metadata?: Json
          names_synced_at?: string | null
          wallet_class?: string
          zora_creator_coin_address?: string | null
          zora_display_name?: string | null
          zora_handle?: string | null
          zora_synced_at?: string | null
        }
        Relationships: []
      }
      zora_csw_owners: {
        Row: {
          base_owner: string | null
          creation_block: number | null
          creation_nonce: number | null
          creation_tx_hash: string | null
          csw_address: string
          current_owners: string[] | null
          first_indexed_at: string
          initial_owners: string[]
          last_owner_sync_at: string | null
          metadata: Json
          source: string
        }
        Insert: {
          base_owner?: string | null
          creation_block?: number | null
          creation_nonce?: number | null
          creation_tx_hash?: string | null
          csw_address: string
          current_owners?: string[] | null
          first_indexed_at?: string
          initial_owners?: string[]
          last_owner_sync_at?: string | null
          metadata?: Json
          source?: string
        }
        Update: {
          base_owner?: string | null
          creation_block?: number | null
          creation_nonce?: number | null
          creation_tx_hash?: string | null
          csw_address?: string
          current_owners?: string[] | null
          first_indexed_at?: string
          initial_owners?: string[]
          last_owner_sync_at?: string | null
          metadata?: Json
          source?: string
        }
        Relationships: []
      }
      zora_profiles: {
        Row: {
          added_at: string
          avatar_image_url: string | null
          basename: string | null
          basename_avatar: string | null
          coin_created_at: string | null
          description: string | null
          ens_avatar: string | null
          ens_name: string | null
          external_wallets: string[]
          farcaster_display_name: string | null
          farcaster_fid: number | null
          farcaster_follower_count: number | null
          farcaster_synced_at: string | null
          farcaster_username: string | null
          handle: string
          install_plan_synced_at: string | null
          is_in_csw_index: boolean | null
          last_refreshed_at: string
          names_synced_at: string | null
          payout_is_cbsw: boolean | null
          payout_recipient: string | null
          payout_recipient_balance_wei: number | null
          payout_recipient_is_contract: boolean | null
          payout_recipient_kind: string | null
          polish_synced_at: string | null
          primary_wallet: string | null
          primary_wallet_kind: string | null
          privy_wallet_address: string | null
          privy_wallet_kind: string | null
          raw_profile: Json | null
          recommended_install_source: string | null
          recommended_install_target: string | null
          signing_eoa: string | null
          signing_eoa_balance_wei: number | null
          signing_eoa_source: string | null
          smart_wallet_address: string | null
          smart_wallet_is_cbsw: boolean | null
          smart_wallet_kind: string | null
          source: string
          twitter_follower_count: number | null
          twitter_username: string | null
          unique_holders: number | null
          volume_24h_usd: number | null
          wallet_kinds_synced_at: string | null
          wallets_synced_at: string | null
          website: string | null
          zora_creator_coin_address: string | null
          zora_creator_coin_market_cap: number | null
          zora_creator_coin_name: string | null
          zora_creator_coin_symbol: string | null
          zora_creator_coin_total_volume: number | null
          zora_display_name: string | null
          zora_profile_id: string | null
        }
        Insert: {
          added_at?: string
          avatar_image_url?: string | null
          basename?: string | null
          basename_avatar?: string | null
          coin_created_at?: string | null
          description?: string | null
          ens_avatar?: string | null
          ens_name?: string | null
          external_wallets?: string[]
          farcaster_display_name?: string | null
          farcaster_fid?: number | null
          farcaster_follower_count?: number | null
          farcaster_synced_at?: string | null
          farcaster_username?: string | null
          handle: string
          install_plan_synced_at?: string | null
          is_in_csw_index?: boolean | null
          last_refreshed_at?: string
          names_synced_at?: string | null
          payout_is_cbsw?: boolean | null
          payout_recipient?: string | null
          payout_recipient_balance_wei?: number | null
          payout_recipient_is_contract?: boolean | null
          payout_recipient_kind?: string | null
          polish_synced_at?: string | null
          primary_wallet?: string | null
          primary_wallet_kind?: string | null
          privy_wallet_address?: string | null
          privy_wallet_kind?: string | null
          raw_profile?: Json | null
          recommended_install_source?: string | null
          recommended_install_target?: string | null
          signing_eoa?: string | null
          signing_eoa_balance_wei?: number | null
          signing_eoa_source?: string | null
          smart_wallet_address?: string | null
          smart_wallet_is_cbsw?: boolean | null
          smart_wallet_kind?: string | null
          source: string
          twitter_follower_count?: number | null
          twitter_username?: string | null
          unique_holders?: number | null
          volume_24h_usd?: number | null
          wallet_kinds_synced_at?: string | null
          wallets_synced_at?: string | null
          website?: string | null
          zora_creator_coin_address?: string | null
          zora_creator_coin_market_cap?: number | null
          zora_creator_coin_name?: string | null
          zora_creator_coin_symbol?: string | null
          zora_creator_coin_total_volume?: number | null
          zora_display_name?: string | null
          zora_profile_id?: string | null
        }
        Update: {
          added_at?: string
          avatar_image_url?: string | null
          basename?: string | null
          basename_avatar?: string | null
          coin_created_at?: string | null
          description?: string | null
          ens_avatar?: string | null
          ens_name?: string | null
          external_wallets?: string[]
          farcaster_display_name?: string | null
          farcaster_fid?: number | null
          farcaster_follower_count?: number | null
          farcaster_synced_at?: string | null
          farcaster_username?: string | null
          handle?: string
          install_plan_synced_at?: string | null
          is_in_csw_index?: boolean | null
          last_refreshed_at?: string
          names_synced_at?: string | null
          payout_is_cbsw?: boolean | null
          payout_recipient?: string | null
          payout_recipient_balance_wei?: number | null
          payout_recipient_is_contract?: boolean | null
          payout_recipient_kind?: string | null
          polish_synced_at?: string | null
          primary_wallet?: string | null
          primary_wallet_kind?: string | null
          privy_wallet_address?: string | null
          privy_wallet_kind?: string | null
          raw_profile?: Json | null
          recommended_install_source?: string | null
          recommended_install_target?: string | null
          signing_eoa?: string | null
          signing_eoa_balance_wei?: number | null
          signing_eoa_source?: string | null
          smart_wallet_address?: string | null
          smart_wallet_is_cbsw?: boolean | null
          smart_wallet_kind?: string | null
          source?: string
          twitter_follower_count?: number | null
          twitter_username?: string | null
          unique_holders?: number | null
          volume_24h_usd?: number | null
          wallet_kinds_synced_at?: string | null
          wallets_synced_at?: string | null
          website?: string | null
          zora_creator_coin_address?: string | null
          zora_creator_coin_market_cap?: number | null
          zora_creator_coin_name?: string | null
          zora_creator_coin_symbol?: string | null
          zora_creator_coin_total_volume?: number | null
          zora_display_name?: string | null
          zora_profile_id?: string | null
        }
        Relationships: []
      }
      zora_profiles_refresh_state: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      points_amoe_eligible_balance: {
        Row: {
          credits: number | null
          signup_id: number | null
        }
        Relationships: []
      }
      v_looker_zora_profiles_ethos: {
        Row: {
          ethos_level: string | null
          ethos_score: number | null
          ethos_score_updated_at: string | null
          ethos_userkey: string | null
          farcaster_follower_count: number | null
          farcaster_username: string | null
          handle: string | null
          is_in_csw_index: boolean | null
          last_refreshed_at: string | null
          payout_recipient: string | null
          payout_recipient_balance_wei: number | null
          primary_wallet: string | null
          primary_wallet_kind: string | null
          privy_wallet_address: string | null
          privy_wallet_kind: string | null
          recommended_install_source: string | null
          recommended_install_target: string | null
          score_wallet: string | null
          signing_eoa: string | null
          signing_eoa_balance_wei: number | null
          signing_eoa_source: string | null
          smart_wallet_address: string | null
          smart_wallet_kind: string | null
          twitter_follower_count: number | null
          twitter_username: string | null
          unique_holders: number | null
          volume_24h_usd: number | null
          zora_creator_coin_address: string | null
          zora_creator_coin_market_cap: number | null
          zora_creator_coin_name: string | null
          zora_creator_coin_symbol: string | null
          zora_creator_coin_total_volume: number | null
          zora_display_name: string | null
        }
        Relationships: []
      }
      v_wallet_directory: {
        Row: {
          avatar_url: string | null
          canonical_wallet: string | null
          directory_created_at: string | null
          directory_updated_at: string | null
          display_name: string | null
          ethos_level: string | null
          ethos_profile_id: number | null
          ethos_score: number | null
          ethos_score_updated_at: string | null
          ethos_userkey: string | null
          last_seen_at: string | null
          privy_user_id: string | null
          profile_id: number | null
          xmtp_address: string | null
          xmtp_inbox_id: string | null
        }
        Relationships: []
      }
      v_zora_owner_ethos_sync_health: {
        Row: {
          matched_cache_rows: number | null
          matched_cache_stale_over_24h: number | null
          newest_cache_score_at: string | null
          newest_projected_score_at: string | null
          observed_at: string | null
          oldest_projected_score_at: string | null
          rows_missing_score: number | null
          rows_stale_over_24h: number | null
          rows_with_score: number | null
          total_rows: number | null
        }
        Relationships: []
      }
      v_zora_profiles_enriched: {
        Row: {
          added_at: string | null
          avatar_image_url: string | null
          basename: string | null
          basename_avatar: string | null
          cohort: string | null
          coin_created_at: string | null
          description: string | null
          ens_avatar: string | null
          ens_name: string | null
          external_wallets: string[] | null
          farcaster_display_name: string | null
          farcaster_fid: number | null
          farcaster_follower_count: number | null
          farcaster_synced_at: string | null
          farcaster_username: string | null
          handle: string | null
          install_plan_synced_at: string | null
          install_readiness: string | null
          is_in_csw_index: boolean | null
          last_refreshed_at: string | null
          names_synced_at: string | null
          payout_is_cbsw: boolean | null
          payout_recipient: string | null
          payout_recipient_balance_wei: number | null
          payout_recipient_is_contract: boolean | null
          payout_recipient_kind: string | null
          polish_synced_at: string | null
          primary_wallet: string | null
          primary_wallet_kind: string | null
          priority_tier: string | null
          privy_wallet_address: string | null
          privy_wallet_kind: string | null
          rank: number | null
          raw_profile: Json | null
          recommended_install_source: string | null
          recommended_install_target: string | null
          signing_eoa: string | null
          signing_eoa_balance_wei: number | null
          signing_eoa_source: string | null
          smart_wallet_address: string | null
          smart_wallet_is_cbsw: boolean | null
          smart_wallet_kind: string | null
          source: string | null
          twitter_follower_count: number | null
          twitter_username: string | null
          unique_holders: number | null
          volume_24h_usd: number | null
          wallet_kinds_synced_at: string | null
          wallets_synced_at: string | null
          website: string | null
          zora_creator_coin_address: string | null
          zora_creator_coin_market_cap: number | null
          zora_creator_coin_name: string | null
          zora_creator_coin_symbol: string | null
          zora_creator_coin_total_volume: number | null
          zora_display_name: string | null
          zora_profile_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      capture_temp_io_snapshot: { Args: never; Returns: number }
      cleanup_expired_rows: { Args: never; Returns: Json }
      cleanup_legacy_backups: {
        Args: { p_arena_backup_days?: number }
        Returns: Json
      }
      cleanup_log_retention: {
        Args: {
          p_agent_api_log_days?: number
          p_agent_api_logs_days?: number
          p_agent_control_audit_days?: number
          p_alfaclub_metrics_snapshot_days?: number
          p_chat_command_days?: number
          p_chat_presence_days?: number
          p_episodic_summaries_days?: number
          p_farcaster_rollout_days?: number
          p_keepr_logs_days?: number
          p_memory_snapshots_days?: number
          p_query_temp_io_days?: number
          p_telegram_action_audit_days?: number
          p_telegram_funnel_days?: number
          p_telegram_funnel_days_v2?: number
          p_telegram_link_days?: number
          p_workspace_activity_days?: number
          p_workspace_audit_days?: number
          p_workspace_monitoring_days?: number
        }
        Returns: Json
      }
      cleanup_operational_retention: {
        Args: {
          p_agent_rate_limits_days?: number
          p_control_plane_terminal_days?: number
          p_index_usage_snapshots_days?: number
          p_keeper_jobs_failed_days?: number
          p_keeper_jobs_succeeded_days?: number
          p_prune_unmapped_ethos_userkeys?: boolean
        }
        Returns: Json
      }
      count_estimate: { Args: { query_text: string }; Returns: number }
      current_privy_user_id: { Args: never; Returns: string }
      get_stale_csw_owner_addresses: {
        Args: { p_limit?: number; p_stale_hours?: number }
        Returns: {
          owner_address: string
        }[]
      }
      insert_creator_access_request_audit: {
        Args: {
          p_changed_by: string
          p_new_status: string
          p_old_status: string
          p_request_id: string
        }
        Returns: undefined
      }
      prune_ethos_daily_snapshots: {
        Args: { keep_days?: number }
        Returns: number
      }
      snapshot_creator_ethos_daily: { Args: never; Returns: number }
      upsert_alfaclub_explore_latest: {
        Args: { payload: Json }
        Returns: number
      }
      upsert_alfaclub_rooms_snapshot: {
        Args: { payload: Json }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
