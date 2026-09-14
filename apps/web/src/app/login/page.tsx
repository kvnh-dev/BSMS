'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form-field';
import { BikeLogoIcon, GstIcon, ServiceTicketIcon } from '@/components/nav-icons';
import { useAuth, ApiError } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      await login(values.phone, values.password);
      router.replace('/dashboard');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-sidebar p-11 lg:flex">
        <div className="absolute -top-28 -right-32 h-96 w-96 rounded-full bg-primary/15" />
        <div className="absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-primary/10" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[9px] bg-primary">
            <BikeLogoIcon className="h-[19px] w-[19px] text-sidebar" />
          </div>
          <span className="text-[16px] font-extrabold text-sidebar-foreground">BSMS</span>
        </div>

        <div className="relative max-w-sm">
          <h1 className="text-[30px] leading-[1.25] font-extrabold tracking-tight text-sidebar-foreground">
            Run your showroom without the paperwork.
          </h1>
          <p className="mt-3.5 text-sm leading-relaxed text-sidebar-foreground/65">
            Inventory, GST billing, services and staff — all in one place, built for how
            Indian bike showrooms actually work.
          </p>
        </div>

        <div className="relative flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[9px] bg-white/10">
              <GstIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[13px] text-sidebar-foreground/85">GST-compliant billing, built in</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[9px] bg-white/10">
              <ServiceTicketIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[13px] text-sidebar-foreground/85">Full service history per bike</span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-[340px] flex-col gap-6.5">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Sign in to your BSMS account.</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField label="Phone number" error={form.formState.errors.phone?.message}>
              <Input {...form.register('phone')} placeholder="10-digit phone number" autoFocus />
            </FormField>
            <FormField label="Password" error={form.formState.errors.password?.message}>
              <Input {...form.register('password')} type="password" />
            </FormField>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Forgot your password? Ask your showroom owner to reset it.
          </p>
        </div>
      </div>
    </div>
  );
}
