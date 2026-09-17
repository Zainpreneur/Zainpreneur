import { Suspense } from 'react'
import { useBusinesses } from '../context/BusinessContext'

export function Assets() {
  const { assets, assetHistory } = useBusinesses()
  return (
    <Suspense fallback={<div>Loading assets…</div>}>
      <div>
        <h1>Asset Hub</h1>
        <p>Assets in central pool: {assets?.length ?? 0}</p>
        <p>Asset history entries: {assetHistory?.length ?? 0}</p>
      </div>
    </Suspense>
  )
}