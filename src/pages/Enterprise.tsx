import { useState } from 'react'

import { PageContainer, PageHeader } from '../components/layout/PageContainer'
import { BillingPanel } from '../components/enterprise/BillingPanel'
import { LedgerPanel } from '../components/enterprise/LedgerPanel'
import { PayrollPanel } from '../components/enterprise/PayrollPanel'
import { ProcurementPanel } from '../components/enterprise/ProcurementPanel'
import { SyncPanel } from '../components/enterprise/SyncPanel'
import { cn } from '../utils/cn'

type Tab = 'procurement' | 'payroll' | 'ledger' | 'billing' | 'sync'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'procurement', label: 'Purchasing' },
  { value: 'payroll', label: 'HR & Payroll' },
  { value: 'ledger', label: 'Ledger & Reports' },
  { value: 'billing', label: 'CRM & Invoicing' },
  { value: 'sync', label: 'Offline Sync' },
]

export function Enterprise() {
  const [tab, setTab] = useState<Tab>('procurement')

  return (
    <PageContainer>
      <PageHeader
        title="Enterprise Integration"
        subtitle="Purchasing, HR & payroll, general ledger, client billing and offline sync — bridged to assets, team and businesses."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                tab === t.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'procurement' && <ProcurementPanel />}
      {tab === 'payroll' && <PayrollPanel />}
      {tab === 'ledger' && <LedgerPanel />}
      {tab === 'billing' && <BillingPanel />}
      {tab === 'sync' && <SyncPanel />}
    </PageContainer>
  )
}
