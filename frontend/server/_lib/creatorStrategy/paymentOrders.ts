type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }>
}

export type PaymentOrderStatus =
  | 'quoted'
  | 'payment_pending'
  | 'paid'
  | 'provisioning_queued'
  | 'provisioning_running'
  | 'manual_review'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'expired'

export async function upsertPaymentOrder(params: {
  db: Db
  orderId: string
  status: PaymentOrderStatus
  amountAtomic: bigint
  currency: string
  policyVersion?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  await params.db.sql`
    INSERT INTO public.payment_orders (
      order_id,
      status,
      amount,
      currency,
      policy_version,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      ${params.orderId},
      ${params.status},
      ${params.amountAtomic.toString()},
      ${params.currency},
      ${params.policyVersion ?? null},
      ${JSON.stringify(params.metadata ?? {})}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      policy_version = COALESCE(EXCLUDED.policy_version, payment_orders.policy_version),
      metadata_json = payment_orders.metadata_json || EXCLUDED.metadata_json,
      updated_at = NOW();
  `
}

