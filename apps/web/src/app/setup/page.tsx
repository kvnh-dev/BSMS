'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setupWizardSchema, type SetupWizardInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField as Field } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

const STEPS = [
  { title: 'Showroom details', fields: ['profile.name', 'profile.address', 'profile.contactNumber', 'profile.email'] as const },
  { title: 'Tax & billing', fields: ['profile.gstin', 'profile.pan', 'profile.state', 'profile.invoicePrefix'] as const },
  { title: 'Your admin login', fields: ['owner.name', 'owner.phone', 'owner.password'] as const },
] as const;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SetupWizardInput>({
    resolver: zodResolver(setupWizardSchema),
    defaultValues: {
      profile: {
        name: '',
        address: '',
        contactNumber: '',
        email: '',
        gstin: '',
        pan: '',
        state: '',
        invoicePrefix: 'SHW',
        currency: 'INR',
        locale: 'en-IN',
      },
      owner: { name: '', phone: '', password: '' },
    },
  });

  const isLastStep = step === STEPS.length - 1;

  async function handleNext() {
    const valid = await form.trigger(STEPS[step].fields as unknown as (keyof SetupWizardInput)[]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: SetupWizardInput) {
    setSubmitting(true);
    try {
      await api.post('/showroom-profile/setup', values);
      toast.success('Showroom set up — you can now log in.');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardDescription>
            Step {step + 1} of {STEPS.length}
          </CardDescription>
          <CardTitle>{STEPS[step].title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {step === 0 && (
              <>
                <Field label="Showroom name" error={form.formState.errors.profile?.name?.message}>
                  <Input {...form.register('profile.name')} placeholder="e.g. Sunrise Bikes" />
                </Field>
                <Field label="Address" error={form.formState.errors.profile?.address?.message}>
                  <Input {...form.register('profile.address')} placeholder="Shop address" />
                </Field>
                <Field label="Contact number" error={form.formState.errors.profile?.contactNumber?.message}>
                  <Input {...form.register('profile.contactNumber')} placeholder="10-digit phone number" />
                </Field>
                <Field label="Email" error={form.formState.errors.profile?.email?.message}>
                  <Input {...form.register('profile.email')} type="email" placeholder="owner@example.com" />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field
                  label="GST Number (GSTIN)"
                  hint="Your 15-character GST registration number — printed on every invoice and required for tax filing."
                  error={form.formState.errors.profile?.gstin?.message}
                >
                  <Input {...form.register('profile.gstin')} placeholder="e.g. 29ABCDE1234F1Z5" />
                </Field>
                <Field label="PAN" error={form.formState.errors.profile?.pan?.message}>
                  <Input {...form.register('profile.pan')} placeholder="e.g. ABCDE1234F" />
                </Field>
                <Field
                  label="State"
                  hint="Used to work out GST tax splitting on invoices."
                  error={form.formState.errors.profile?.state?.message}
                >
                  <Input {...form.register('profile.state')} placeholder="e.g. Karnataka" />
                </Field>
                <Field
                  label="Invoice number prefix"
                  hint={`Invoices will be numbered like ${form.watch('profile.invoicePrefix') || 'SHW'}-2026-0001`}
                  error={form.formState.errors.profile?.invoicePrefix?.message}
                >
                  <Input {...form.register('profile.invoicePrefix')} placeholder="SHW" />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Your name" error={form.formState.errors.owner?.name?.message}>
                  <Input {...form.register('owner.name')} placeholder="Your full name" />
                </Field>
                <Field label="Phone number (used to log in)" error={form.formState.errors.owner?.phone?.message}>
                  <Input {...form.register('owner.phone')} placeholder="10-digit phone number" />
                </Field>
                <Field label="Password" error={form.formState.errors.owner?.password?.message}>
                  <Input {...form.register('owner.password')} type="password" placeholder="At least 8 characters" />
                </Field>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
              >
                Back
              </Button>
              {isLastStep ? (
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Setting up…' : 'Finish setup'}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
