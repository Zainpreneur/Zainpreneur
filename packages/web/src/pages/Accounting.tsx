// @ts-nocheck
import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { LedgerPanel } from '../components/enterprise/LedgerPanel'

export function Accounting() {
  return (
    <PageContainer>
      <PageHeader
        title="Accounting & Ledger"
        subtitle="Zainpreneur's master general ledger — trial balance, P&L, distributions and depreciation."
      />
      <LedgerPanel />
    </PageContainer>
  )
}
