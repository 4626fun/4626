-- Schema-bootstrap ledger: durable "already applied" record for runtime cold-start
-- bootstrap (frontend/server/_lib/db/schemaBootstrap.ts ensureMigrationApplied).
--
-- Why: every serverless cold start replayed full migration files (CREATE TABLE IF NOT
-- EXISTS, ALTER TABLE ADD COLUMN, ENABLE ROW LEVEL SECURITY, CREATE OR REPLACE FUNCTION...).
-- pg_stat_statements showed ~3,300 replays of the AlfaClub schema files and 1,251 replays
-- of final_additive_columns -- the creator_coins ALTER alone burned ~39 minutes of ACCESS
-- EXCLUSIVE lock time, and the constant DDL invalidated PostgREST's schema cache
-- (23K introspection reloads, ~54 minutes). With this ledger, a cold start does one cheap
-- SELECT per file instead of replaying DDL.
--
-- To force a re-apply of a file on next cold start: DELETE FROM public.schema_bootstrap_ledger WHERE filename = '...';
CREATE TABLE IF NOT EXISTS public.schema_bootstrap_ledger (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schema_bootstrap_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schema_bootstrap_ledger' AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest" ON public.schema_bootstrap_ledger
      AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
END $$;

-- Seed with every migration file that exists as of this migration. The live database has
-- all of them applied (via supabase migrations / prior bootstrap replays), so recording
-- them prevents one final replay wave after the code deploy.
INSERT INTO public.schema_bootstrap_ledger (filename) VALUES
  ('20260108183605_creator_access_tables.sql'),
  ('20260216082123_creator_metrics_chain_checkpoint.sql'),
  ('20260216095709_enable_rls_and_cleanup_public_warnings.sql'),
  ('20260216095859_add_explicit_deny_policies_for_rls_tables.sql'),
  ('20260216095925_drop_unused_indexes_from_advisor_report.sql'),
  ('20260216095943_restore_profile_wallets_fk_covering_index.sql'),
  ('20260216101202_allow_null_email_in_profiles.sql'),
  ('20260216101736_block_noemail_synthetic_domain.sql'),
  ('20260216102658_block_legacy_synthetic_example_emails.sql'),
  ('20260218152546_create_agent_registration_state.sql'),
  ('20260218155022_add_storage_key_to_agent_registration_state.sql'),
  ('20260224120459_add_points_unique_source_full_index.sql'),
  ('20260304083253_rls_enable_and_duplicate_index_cleanup_20260304.sql'),
  ('20260304084624_rls_policy_defaults_20260304.sql'),
  ('20260304085255_unused_index_prune_phase2_20260304.sql'),
  ('20260304091733_unused_index_prune_phase3_20260304.sql'),
  ('20260304093139_unused_index_prune_phase4_20260304.sql'),
  ('20260304093806_functional_wallet_lookup_indexes_phase5_20260304.sql'),
  ('20260304113805_index_usage_monitoring_phase6_20260304.sql'),
  ('20260304113931_index_usage_monitoring_security_hardening_phase6b_20260304.sql'),
  ('20260304114709_unused_index_prune_phase7_live_reconcile_20260304.sql'),
  ('20260304114846_index_drop_candidates_scope_hardening_phase6c_20260304.sql'),
  ('20260304115617_restore_phase7_indexes_prelaunch_20260304.sql'),
  ('20260304120227_drop_subdomain_indexes_prelaunch_20260304.sql'),
  ('20260304120829_016_drop_optional_prelaunch_indexes.sql'),
  ('20260304121324_017_drop_subdomain_tables_prelaunch.sql'),
  ('20260305064259_018_canonical_csw_delegation_columns.sql'),
  ('20260305064342_019_accounts_identity_linking.sql'),
  ('20260401233000_drop_unused_runtime_indexes.sql'),
  ('20260402071500_add_scheduled_cleanup_jobs.sql'),
  ('20260402080500_drop_legacy_arena_and_subdomain_tables.sql'),
  ('20260402084500_schedule_legacy_backup_purge.sql'),
  ('20260402100000_migrate_waitlist_keepr_runtime_schema.sql'),
  ('20260402113000_align_profile_wallets_canonical_csw_columns.sql'),
  ('20260411233000_drop_unused_miniapp_notifications_table.sql'),
  ('20260418034822_027_command_issuer_execution_context.sql'),
  ('20260419044827_deny_all_policies_and_cleanup.sql'),
  ('20260419063345_profile_merge_infra.sql'),
  ('20260419063348_enable_rls_workspace_and_identity.sql'),
  ('20260419170000_creator_strategy_features.sql'),
  ('20260419180000_creator_strategy_payment_paths.sql'),
  ('20260422230000_kpr_runtime_and_agent_rate_limits_schema.sql'),
  ('20260422230500_deploys_restore_deny_all_policy.sql'),
  ('20260422231500_document_service_role_only_tables.sql'),
  ('20260423193000_deploy_sessions_v2_schema.sql'),
  ('20260427180000_amoe_eligible_points_view.sql'),
  ('20260429000000_amoe_zk_submissions.sql'),
  ('20260429000001_add_max_assets_cap.sql'),
  ('20260429010000_amoe_points_burn_ledger.sql'),
  ('20260429020000_amoe_publisher_runs.sql'),
  ('20260430023000_ethos_chat_presence_and_vault_chat.sql'),
  ('20260430190000_amoe_entry_refund_source.sql'),
  ('20260501000000_alfaclub_user_preferences.sql'),
  ('20260506221000_keeper_job_coordination_queue.sql'),
  ('20260507033000_website_waitlist_attribution.sql'),
  ('20260511044500_hard_normalize_points_to_amoe_model.sql'),
  ('20260512010000_ajna_vault_registry.sql'),
  ('20260515043000_amoe_view_invoker_and_xmtp_rls.sql'),
  ('20260515104000_amoe_twitter_checkin_tweet_proof.sql'),
  ('20260515112000_amoe_xmtp_checkin_message_proof.sql'),
  ('20260518003000_legacy_runtime_tables_to_kpr.sql'),
  ('20260518165000_control_plane_operations.sql'),
  ('20260518190000_control_plane_stages_events_and_payment_ledgers.sql'),
  ('20260518220000_zora_table_maintenance.sql'),
  ('20260519120000_arch_b_sub_account_columns.sql'),
  ('20260519130000_control_plane_operation_kind_allow_dots.sql'),
  ('20260520120000_zora_profiles_refresh_monitoring.sql'),
  ('20260520130000_creator_ethos_refresh_orders.sql'),
  ('20260523120000_creator_metrics_state_cached_totals.sql'),
  ('20260525120000_creator_coins_display_columns.sql'),
  ('20260525130000_creator_coins_sparkline_30d.sql'),
  ('20260526000000_alfaclub_chat_ingest.sql'),
  ('20260526010000_alfaclub_room_access.sql'),
  ('20260526020000_alfaclub_vigilante_core.sql'),
  ('20260526030000_alfaclub_radar_and_cooldown.sql'),
  ('20260527000000_amoe_lottery_tables.sql'),
  ('20260527010000_creator_metrics_base_tables.sql'),
  ('20260528000000_telegram_trading_schema.sql'),
  ('20260529000000_workspace_schema.sql'),
  ('20260530000000_agent_memory_schema.sql'),
  ('20260531000000_chat_schema.sql'),
  ('20260601000000_image_generation_schema.sql'),
  ('20260602000000_alfaclub_room_welcome.sql'),
  ('20260602000000_wallet_intelligence_cache_schema.sql'),
  ('20260603000000_zora_csw_gate_schema.sql'),
  ('20260604000000_creator_access_schema.sql'),
  ('20260605000000_agent_access_schema.sql'),
  ('20260606000000_auth_nonce_handoff_schema.sql'),
  ('20260606010000_alfaclub_proliquid_signal_ingest.sql'),
  ('20260607000000_agent_runtime_audit_ledger_schema.sql'),
  ('20260608000000_wallet_onchain_ops_audit_schema.sql'),
  ('20260609000000_telemetry_creative_logs_schema.sql'),
  ('20260610000000_alfaclub_daily_brief_dispatch.sql'),
  ('20260611000000_final_additive_columns.sql'),
  ('20260611100000_keeper_cre_attestation_schema.sql'),
  ('20260612000000_chart_friendly_ethos_structures.sql'),
  ('20260612000000_extend_telemetry_retention.sql'),
  ('20260613000000_ethos_time_series_snapshots.sql'),
  ('20260614000000_schedule_ethos_chart_snapshots.sql'),
  ('20260615000000_ethos_hourly_snapshots.sql'),
  ('20260616000000_ethos_15min_snapshots.sql'),
  ('20260617000000_ethos_market_cap_buckets.sql'),
  ('20260618000000_ethos_additional_buckets.sql'),
  ('20260619000000_ethos_chart_monitoring_views.sql'),
  ('20260620000000_unified_ethos_chart_support.sql'),
  ('20260621000000_explore_sort_indexes.sql'),
  ('20260622000000_explore_creators_view.sql'),
  ('20260623000000_more_explore_sort_indexes.sql'),
  ('20260624000000_deprecate_separate_bucket_tables.sql'),
  ('20260625000000_explore_use_unified_view.sql'),
  ('20260626000000_final_explore_indexes.sql'),
  ('20260627000000_even_more_explore_indexes.sql'),
  ('20260628000000_last_explore_indexes.sql'),
  ('20260629000000_final_explore_index_round.sql'),
  ('20260630000000_more_targeted_explore_indexes.sql'),
  ('20260701000000_ethos_index_usage_view.sql'),
  ('20260702000000_ethos_unused_indexes_view.sql'),
  ('20260703000000_one_more_strong_explore_index.sql'),
  ('20260704000000_ethos_query_performance.sql'),
  ('20260705000000_drop_orphan_query_temp_io_snapshots.sql'),
  ('20260705010000_cleanup_retention_after_query_temp_io_drop.sql'),
  ('20260706000000_alfaclub_command_reply_ledger.sql'),
  ('20260707000000_alfaclub_position_alerts.sql'),
  ('20260708000000_alfaclub_arena_identity_mappings.sql'),
  ('20260709000000_alfaclub_counter_trade_engine.sql'),
  ('20260710000000_alfaclub_room_label_cache.sql'),
  ('20260711000000_solana_share_mesh_mappings.sql'),
  ('20260712000000_base_mcp_approval_requests.sql'),
  ('20260713000000_drop_deprecated_ethos_bucket_tables.sql'),
  ('20260713010000_drop_ethos_high_frequency_snapshots.sql'),
  ('20260713020000_drop_dead_scaffold_tables.sql'),
  ('20260713030000_ethos_index_and_snapshot_optimization.sql'),
  ('20260713040000_creator_coins_lower_address_index.sql'),
  ('20260713050000_creator_coins_volume_rank_index.sql'),
  ('20260713060000_drop_resurrected_ethos_15min.sql')
ON CONFLICT (filename) DO NOTHING;
