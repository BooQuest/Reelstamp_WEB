// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { paymentProof } from './payment-proof';
afterEach(()=>vi.unstubAllEnvs());
it('signs the exact event and timestamp without exposing the key',()=>{
 const key='ab'.repeat(32);vi.stubEnv('PAYMENT_EVENT_SIGNING_KEY',key);
 const event={kind:'PASS' as const,orderId:'PASS-test',paymentNo:'123',amount:100,payState:4};
 const headers=paymentProof(event),payload=Buffer.from(headers['X-Payment-Proof'],'base64url').toString();
 expect(JSON.parse(payload)).toMatchObject(event);
 expect(headers['X-Payment-Signature']).toBe(createHmac('sha256',Buffer.from(key,'hex')).update(payload).digest('hex'));
 expect(JSON.stringify(headers)).not.toContain(key);
 expect(createHmac('sha256',Buffer.from(key,'hex')).update(payload.replace('100','101')).digest('hex')).not.toBe(headers['X-Payment-Signature']);
});
it('rejects malformed configured keys instead of silently omitting verification',()=>{
 vi.stubEnv('PAYMENT_EVENT_SIGNING_KEY','bad');expect(()=>paymentProof({kind:'LEGACY',orderId:'o',paymentNo:'1',amount:1,payState:4})).toThrow();
});
