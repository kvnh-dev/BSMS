'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { PERSONAS, type CreateUserInput } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/form-field';
import { api, ApiError } from '@/lib/api-client';

interface WorkerUser {
  id: string;
  name: string;
  personas: string[];
}

// Reached only from the technician picker's Alt+C target — defaults the
// TECHNICIAN persona pre-checked, since that's the one use case this Sheet
// serves (a full, unrestricted worker account is still created via the
// dedicated /workers/new page).
export function QuickAddWorkerSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (worker: WorkerUser) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CreateUserInput>({
    defaultValues: { name: '', phone: '', password: '', personas: ['TECHNICIAN'] },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => api.post<WorkerUser>('/users', input),
    onSuccess: (worker) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Worker account created');
      onCreated(worker);
      onOpenChange(false);
      form.reset({ name: '', phone: '', password: '', personas: ['TECHNICIAN'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create worker'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New worker</SheetTitle>
        </SheetHeader>
        <form
          id="quick-add-worker-form"
          onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
          className="flex flex-col gap-3"
        >
          <FormField label="Name">
            <Input {...form.register('name', { required: true })} />
          </FormField>
          <FormField label="Phone number (used to log in)">
            <Input {...form.register('phone', { required: true })} />
          </FormField>
          <FormField label="Temporary password">
            <Input type="password" {...form.register('password', { required: true, minLength: 8 })} />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <Label>Personas</Label>
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
        </form>
        <SheetFooter>
          <Button type="submit" form="quick-add-worker-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create worker'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
