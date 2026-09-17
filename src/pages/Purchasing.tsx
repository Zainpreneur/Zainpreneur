import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { ProcurementPanel } from '../components/enterprise/ProcurementPanel'

export function Purchasing() {
  return (
    <PageContainer>
      <PageHeader
        title="Vendors & Purchasing"
        subtitle="Supplier profiles and purchase orders — receiving provisions the Zainpreneur asset pool."
      />
      <ProcurementPanel />
    </PageContainer>
  )
}
