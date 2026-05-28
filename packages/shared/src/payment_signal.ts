export const PAYMENT_SIGNAL_QUOTE_LOOKBACK_DAYS = 30;
export const PAYMENT_SIGNAL_SMALL_PAYMENT_DECIMAL = 0.1;
export const PAYMENT_SIGNAL_OUTLIER_MULTIPLIER = 20;
export const PAYMENT_SIGNAL_OUTLIER_MIN_AMOUNT_DECIMAL = 1;

export function buildPaymentSignalCtes(eventAlias = "pe"): string {
  const quoteLookback = `${PAYMENT_SIGNAL_QUOTE_LOOKBACK_DAYS} days`;
  const outlierMinAmount = PAYMENT_SIGNAL_OUTLIER_MIN_AMOUNT_DECIMAL.toFixed(6);
  const smallPaymentAmount = PAYMENT_SIGNAL_SMALL_PAYMENT_DECIMAL.toFixed(6);

  return `
    quote_reference AS (
      SELECT
        COALESCE(o.seller_id, r.seller_id) AS seller_id,
        LOWER(o.payto) AS payto,
        ARRAY_AGG(DISTINCT o.amount_raw) FILTER (
          WHERE o.amount_raw ~ '^[0-9]+$'
        ) AS expected_amounts,
        MAX((o.amount_raw)::numeric) FILTER (
          WHERE o.amount_raw ~ '^[0-9]+$'
        ) AS max_expected_raw
      FROM discovery_probe_observation o
      LEFT JOIN resources r ON r.id = o.resource_id
      WHERE o.probe_kind = 'resource'
        AND o.payto IS NOT NULL
        AND o.amount_raw IS NOT NULL
        AND o.observed_at >= NOW() - INTERVAL '${quoteLookback}'
        AND COALESCE(o.seller_id, r.seller_id) IS NOT NULL
      GROUP BY COALESCE(o.seller_id, r.seller_id), LOWER(o.payto)
    ),
    classified_payments AS (
      SELECT
        ${eventAlias}.id,
        ${eventAlias}.chain,
        ${eventAlias}.seller_id,
        ${eventAlias}.resource_id,
        ${eventAlias}.payer,
        ${eventAlias}.payto,
        ${eventAlias}.amount_raw,
        ${eventAlias}.amount_decimal,
        ${eventAlias}.observed_at,
        ${eventAlias}.confidence,
        CASE
          WHEN COALESCE(array_length(qr.expected_amounts, 1), 0) > 0
            AND ${eventAlias}.amount_raw::text = ANY(qr.expected_amounts)
          THEN 'x402_quote_match'
          WHEN qr.max_expected_raw IS NOT NULL
            AND ${eventAlias}.amount_decimal >= ${outlierMinAmount}::numeric
            AND ${eventAlias}.amount_raw >= GREATEST(
              qr.max_expected_raw * ${PAYMENT_SIGNAL_OUTLIER_MULTIPLIER},
              ${outlierMinAmount}::numeric * 1000000::numeric
            )
          THEN 'topup_outlier'
          WHEN ${eventAlias}.amount_decimal <= ${smallPaymentAmount}::numeric
          THEN 'probable_x402_small'
          ELSE 'unknown'
        END AS payment_signal
      FROM payment_event ${eventAlias}
      LEFT JOIN quote_reference qr
        ON qr.seller_id = ${eventAlias}.seller_id
       AND qr.payto = LOWER(${eventAlias}.payto)
    )
  `;
}
