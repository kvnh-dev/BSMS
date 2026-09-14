'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.get<{ isSetupComplete: boolean }>('/showroom-profile/setup-status'),
  });

  useEffect(() => {
    if (authLoading || setupLoading || !setupStatus) return;
    if (!setupStatus.isSetupComplete) {
      router.replace('/setup');
    } else if (!user) {
      router.replace('/login');
    } else {
      router.replace('/dashboard');
    }
  }, [authLoading, setupLoading, setupStatus, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
