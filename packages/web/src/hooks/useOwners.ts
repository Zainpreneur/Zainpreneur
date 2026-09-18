import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ownersApi } from '../api/owners'

export function useOwners() {
  return useQuery({
    queryKey: ['owners'],
    queryFn: ownersApi.list,
  })
}

export function useCreateOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ownersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owners'] }),
  })
}

export function useUpdateOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      ownersApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owners'] }),
  })
}

export function useDeleteOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ownersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owners'] }),
  })
}
