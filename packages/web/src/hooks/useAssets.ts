import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetsApi } from '../api/assets'

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: assetsApi.list,
  })
}

export function useCreateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assetsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

export function useUpdateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      assetsApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assetsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

export function useDeployAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, input }: { assetId: string; input: Record<string, unknown> }) =>
      assetsApi.deploy(assetId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

export function useReturnAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, notes }: { assetId: string; notes?: string }) =>
      assetsApi.return(assetId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}
