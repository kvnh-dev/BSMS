'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface DelegationTask {
  id: string;
  taskType: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
  assignedTo: { name: string };
}

export default function DelegationPage() {
  const { hasPersona } = useAuth();
  const isOwner = hasPersona('OWNER');
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['delegation-tasks'],
    queryFn: () => api.get<DelegationTask[]>('/delegation-tasks'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.patch(`/delegation-tasks/${id}/review`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] });
      toast.success('Reviewed');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Review failed'),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">{isOwner ? 'Delegation Queue' : 'My Tasks'}</h1>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isOwner && <TableHead>Requested by</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              {isOwner && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks?.map((task) => (
              <TableRow key={task.id}>
                {isOwner && <TableCell>{task.assignedTo.name}</TableCell>}
                <TableCell>{task.taskType}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {JSON.stringify(task.payload)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                {isOwner && (
                  <TableCell className="flex gap-2">
                    {task.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => reviewMutation.mutate({ id: task.id, status: 'APPROVED' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewMutation.mutate({ id: task.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {tasks?.length === 0 && (
              <TableRow>
                <TableCell colSpan={isOwner ? 5 : 3} className="text-center text-muted-foreground py-8">
                  Nothing here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
