import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { businessesApi, branchesApi } from '../api/businesses'

export function useBusinesses() {
  return useQuery({
    queryKey: ['businesses'],
    queryFn: businessesApi.list,
  })
}

export function useBusiness(id: string) {
  return useQuery({
    queryKey: ['businesses', id],
    queryFn: () => businessesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: businessesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  })
}

export function useUpdateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      businessesApi.update(id, patch),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['businesses'] })
      qc.invalidateQueries({ queryKey: ['businesses', vars.id] })
    },
  })
}

export function useDeleteBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: businessesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  })
}

export function useBranches(businessId: string) {
  return useQuery({
    queryKey: ['branches', businessId],
    queryFn: () => branchesApi.list(businessId),
    enabled: !!businessId,
  })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ businessId, ...draft }: { businessId: string } & Record<string, unknown>) =>
      branchesApi.create(businessId, draft),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['branches', vars.businessId] })
      qc.invalidateQueries({ queryKey: ['businesses'] })
    },
  })
}
