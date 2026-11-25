import 'server-only';
import { createHmac } from 'node:crypto';

/** Call only after merchant/link credentials and provider fields have been verified. */
export function paymentProof(event: {
  kind: 'PASS' | 'LEGACY'; orderId: string; paymentNo: string; amount: number;
  payState: number; eventDate?: string; cancelAmount?: string; sourcePaymentNo?: string;
}): Record<string, string> {
  const key = process.env.PAYMENT_EVENT_SIGNING_KEY;
  // Staged deployment: mandatory in DB before physical deletion is enabled.
  if (!key) return {};
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid payment signing configuration');
  const payload = JSON.stringify({ ...event, issuedAt: Math.floor(Date.now() / 1000) });
  return {
    'X-Payment-Proof': Buffer.from(payload).toString('base64url'),
    'X-Payment-Signature': createHmac('sha256', Buffer.from(key, 'hex')).update(payload).digest('hex'),
  };
}
