import type { Metadata } from 'next';
import AccountDeletionClient from './AccountDeletionClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '회원 탈퇴 | Reelstamp', referrer: 'no-referrer' };

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}
