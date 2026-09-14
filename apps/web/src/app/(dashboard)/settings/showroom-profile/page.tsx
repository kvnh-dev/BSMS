'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { showroomProfileSchema } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

function downloadBackup() {
  return api.get<Record<string, unknown>>('/data-export/all').then((data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bsms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

const editableProfileSchema = showroomProfileSchema.omit({ logoUrl: true, currency: true, locale: true });
type EditableProfile = {
  name: string;
  address: string;
  contactNumber: string;
  email: string;
  gstin: string;
  pan: string;
  state: string;
  invoicePrefix: string;
};

export default function ShowroomProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['showroom-profile'],
    queryFn: () => api.get<EditableProfile>('/showroom-profile'),
  });

  const form = useForm<EditableProfile>({
    resolver: zodResolver(editableProfileSchema),
    defaultValues: {
      name: '',
      address: '',
      contactNumber: '',
      email: '',
      gstin: '',
      pan: '',
      state: '',
      invoicePrefix: '',
    },
  });

  // Populate the form once the current profile loads — it's fetched, not
  // known up front, so defaultValues alone can't cover it.
  useEffect(() => {
    if (profile) form.reset(profile);
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: (input: EditableProfile) => api.patch('/showroom-profile', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showroom-profile'] });
      toast.success('Showroom profile updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to update profile'),
  });

  const backupMutation = useMutation({
    mutationFn: downloadBackup,
    onSuccess: () => toast.success('Backup downloaded'),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to download backup'),
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Showroom Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          These details appear on every printed invoice and GST filing export.
        </p>
      </div>

      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>Set during initial setup — update here any time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField label="Showroom name" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} placeholder="e.g. Sunrise Bikes" />
            </FormField>
            <FormField label="Address" error={form.formState.errors.address?.message}>
              <Input {...form.register('address')} placeholder="Shop address" />
            </FormField>
            <FormField label="Contact number" error={form.formState.errors.contactNumber?.message}>
              <Input {...form.register('contactNumber')} placeholder="10-digit phone number" />
            </FormField>
            <FormField label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register('email')} type="email" placeholder="owner@example.com" />
            </FormField>
            <FormField
              label="GST Number (GSTIN)"
              hint="Your 15-character GST registration number — printed on every invoice."
              error={form.formState.errors.gstin?.message}
            >
              <Input {...form.register('gstin')} placeholder="e.g. 29ABCDE1234F1Z5" />
            </FormField>
            <FormField label="PAN" error={form.formState.errors.pan?.message}>
              <Input {...form.register('pan')} placeholder="e.g. ABCDE1234F" />
            </FormField>
            <FormField
              label="State"
              hint="Used to work out GST tax splitting on invoices."
              error={form.formState.errors.state?.message}
            >
              <Input {...form.register('state')} placeholder="e.g. Karnataka" />
            </FormField>
            <FormField
              label="Invoice number prefix"
              hint={`Invoices are numbered like ${form.watch('invoicePrefix') || 'SHW'}-2026-0001. Changing this only affects future invoices.`}
              error={form.formState.errors.invoicePrefix?.message}
            >
              <Input {...form.register('invoicePrefix')} placeholder="SHW" />
            </FormField>

            <Button type="submit" className="self-start" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl w-full mx-auto mt-6">
        <CardHeader>
          <CardTitle>Data backup</CardTitle>
          <CardDescription>
            Download every customer, bike, invoice, payment, and other business record as one JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
          >
            {backupMutation.isPending ? 'Preparing…' : 'Download backup'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
