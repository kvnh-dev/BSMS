'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGlobalShortcuts } from '@/lib/use-global-shortcuts';
import { useEscapeBack } from '@/lib/use-escape-back';
import { NAV_GROUPS } from '@/lib/nav-groups';
import { shortcutForNavHref } from '@/lib/shortcuts-registry';
import { Kbd } from '@/components/kbd';
import { QuickCreateProvider } from '@/lib/quick-create-context';
import { VoucherDraftsProvider } from '@/lib/voucher-drafts-context';
import { GoToBar } from '@/components/go-to-bar';
import { QuickCreateLauncher } from '@/components/quick-create-launcher';
import { VoucherTaskbar } from '@/components/voucher-taskbar';
import { BikeLogoIcon, LogoutIcon } from '@/components/nav-icons';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPersona } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [goToOpen, setGoToOpen] = useState(false);

  useGlobalShortcuts({
    onOpenGoTo: () => setGoToOpen(true),
    onNavigateHome: () => router.push('/dashboard'),
    onFocusTaskbar: () => {
      const chip = document.querySelector<HTMLButtonElement>('[data-slot="voucher-taskbar"] button');
      if (chip) chip.focus();
      else toast.info('No in-progress vouchers right now');
    },
  });
  useEscapeBack();

  const { data: profile } = useQuery({
    queryKey: ['showroom-profile'],
    queryFn: () => api.get<{ name: string } | null>('/showroom-profile'),
    enabled: !!user,
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <VoucherDraftsProvider>
    <QuickCreateProvider>
    <div className="flex flex-col h-screen">
    <div className="flex flex-1 min-h-0">
      <aside className="w-64 shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground flex flex-col p-3.5 print:hidden">
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-5">
          <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[9px] bg-primary">
            <BikeLogoIcon className="h-[19px] w-[19px] text-sidebar" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-sidebar-foreground">
              {profile?.name ?? 'BSMS'}
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">BSMS</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.personas || hasPersona(...item.personas));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="flex flex-col gap-0.5">
                <div className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.07em] text-sidebar-foreground/50 uppercase">
                  {group.label}
                </div>
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  const ItemIcon = item.icon;
                  const shortcut = shortcutForNavHref(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                      )}
                    >
                      <ItemIcon className={cn('shrink-0', active ? 'text-primary' : 'text-current')} />
                      <span className="flex-1">{item.label}</span>
                      {shortcut && (
                        <Kbd className="border-sidebar-foreground/20 bg-sidebar-foreground/10 px-1.5 py-0 text-[10px] text-sidebar-foreground/60 shadow-none">
                          {shortcut}
                        </Kbd>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="mt-2 flex items-center gap-2.5 border-t border-sidebar-border pt-2.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-sidebar">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{user.personas[0]}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={logout}
            aria-label="Log out"
          >
            <LogoutIcon className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background p-7 print:overflow-visible print:p-0">{children}</main>
      <GoToBar open={goToOpen} onOpenChange={setGoToOpen} />
      <QuickCreateLauncher />
    </div>
    <VoucherTaskbar />
    </div>
    </QuickCreateProvider>
    </VoucherDraftsProvider>
  );
}
