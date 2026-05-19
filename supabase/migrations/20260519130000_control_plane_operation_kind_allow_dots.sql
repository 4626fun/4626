-- Allow dotted operation kinds (vault.settle, solana.reconcile, payment.activation).
-- Prior regex only permitted [a-z0-9_:-], so every dotted kind failed
-- control_plane_operations_operation_kind_check on insert.

ALTER TABLE public.control_plane_operations
  DROP CONSTRAINT IF EXISTS control_plane_operations_operation_kind_check;

ALTER TABLE public.control_plane_operations
  ADD CONSTRAINT control_plane_operations_operation_kind_check
  CHECK (operation_kind ~ '^[a-z][a-z0-9_.:-]{2,63}$');
