import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  if (!store.get('spotify_refresh_token')?.value) {
    redirect('/');
  }
  return <>{children}</>;
}
