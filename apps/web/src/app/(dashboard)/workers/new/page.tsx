'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { PERSONAS, type CreateUserInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';

interface WorkerUser {
  id: string;
}

export default function NewWorkerPage() {
  const router = useRouter();

  const form = useForm<CreateUserInput>({
    defaultValues: { name: '', phone: '', password: '', personas: [] },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => api.post<WorkerUser>('/users', input),
    onSuccess: (worker) => {
      toast.success('Worker account created');
      router.push(`/workers/${worker.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create worker'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Workers', href: '/workers' }, { label: 'New worker' }]} />
      <Card className="max-w-xl w-full mx-auto">
        <CardHeader>
          <CardTitle>Add worker account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} autoFocus />
            </FormField>
            <FormField label="Phone number (used to log in)">
              <Input {...form.register('phone', { required: true })} />
            </FormField>
            <FormField label="Temporary password">
              <Input type="password" {...form.register('password', { required: true, minLength: 8 })} />
            </FormField>
            <div className="flex flex-col gap-1.5">
              <Label>Personas (a worker can hold more than one)</Label>
              <Controller
                control={form.control}
                name="personas"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {PERSONAS.map((persona) => (
                      <label key={persona} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={field.value?.includes(persona)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...(field.value ?? []), persona]
                              : (field.value ?? []).filter((p) => p !== persona);
                            field.onChange(next);
                          }}
                        />
                        {persona}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create worker'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push('/workers')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
