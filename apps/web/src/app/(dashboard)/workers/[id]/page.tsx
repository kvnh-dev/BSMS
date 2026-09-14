'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERSONAS, type Persona } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form-field';
import { Breadcrumb } from '@/components/breadcrumb';
import { api, ApiError } from '@/lib/api-client';

interface WorkerUser {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  personas: Persona[];
}

interface EditForm {
  name: string;
  personas: Persona[];
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
}

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: worker, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => api.get<WorkerUser>(`/users/${id}`),
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance', 'worker', id],
    queryFn: () => api.get<AttendanceRecord[]>(`/attendance?userId=${id}`),
  });

  const form = useForm<EditForm>({ defaultValues: { name: '', personas: [] } });

  useEffect(() => {
    if (worker) form.reset({ name: worker.name, personas: worker.personas });
  }, [worker, form]);

  const saveMutation = useMutation({
    mutationFn: (values: EditForm) => api.patch(`/users/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Worker updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to update worker'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(worker?.isActive ? 'Worker disabled' : 'Worker enabled');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update failed'),
  });

  if (isLoading || !worker) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Workers', href: '/workers' }, { label: worker.name }]} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{worker.name}</CardTitle>
          <Badge variant={worker.isActive ? 'default' : 'secondary'}>
            {worker.isActive ? 'Active' : 'Disabled'}
          </Badge>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{worker.phone}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleActiveMutation.mutate(!worker.isActive)}
            disabled={toggleActiveMutation.isPending}
          >
            {worker.isActive ? 'Disable this worker' : 'Enable this worker'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <Card className="max-w-xl lg:shrink-0">
        <CardHeader>
          <CardTitle>Edit details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="flex flex-col gap-3">
            <FormField label="Name">
              <Input {...form.register('name', { required: true })} />
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
            <Button type="submit" className="self-start" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Recent attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {!attendance ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded for {worker.name} yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {attendance.slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <span className="font-medium">{new Date(record.date).toLocaleDateString()}</span>
                  <span className="text-muted-foreground">
                    {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {record.checkOut
                      ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'still in'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
