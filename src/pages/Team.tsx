import { Suspense } from 'react'
import { useBusinesses } from '../context/BusinessContext'

export function Team() {
  const { teamMembers } = useBusinesses()
  return (
    <Suspense fallback={<div>Loading team…</div>}>
      <div>
        <h1>Team & Resource Management</h1>
        <p>Global team members: {teamMembers?.length ?? 0}</p>
      </div>
    </Suspense>
  )
}