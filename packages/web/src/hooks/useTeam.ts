import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '../api/team'

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: teamApi.list,
  })
}

export function useCreateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: teamApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      teamApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useDeleteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: teamApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}
