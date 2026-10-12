import { redirect } from 'next/navigation';

export default function CompletedReelsPage() {
  redirect('/my-projects?status=COMPLETED');
}
