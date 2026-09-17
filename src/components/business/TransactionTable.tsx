import { Pencil, Trash2 } from 'lucide-react'

import type { Business, CurrencyCode, Transaction } from '../../types'
import { TRANSACTION_CATEGORY_LABELS } from '../../types'
import { formatCurrency, formatShortDate } from '../../utils/format'
import { TXN_STATUS_META } from '../../utils/meta'
import { cn } from '../../utils/cn'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Td, Th, THead, Table, TBody, Tr } from '../ui/Table'

interface TransactionTableProps {
  transactions: Transaction[]
  businesses: Business[]
  currency: CurrencyCode
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  showBusiness?: boolean
}

export function TransactionTable({ transactions, businesses, currency, onEdit, onDelete, showBusiness = true }: TransactionTableProps) {
  const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? 'Unknown'

  return (
    <Table stacked>
      <THead>
        <Tr>
          <Th>Date</Th>
          <Th>Description</Th>
          {showBusiness && <Th>Business</Th>}
          <Th>Category</Th>
          <Th className="text-right">Amount</Th>
          <Th>Status</Th>
          {(onEdit || onDelete) && <Th className="text-right">Actions</Th>}
        </Tr>
      </THead>
      <TBody stacked>
        {transactions.map((tx) => {
          const statusMeta = TXN_STATUS_META[tx.status]
          return (
            <Tr key={tx.id}>
              <Td stackedLabel="Date" className="text-slate-500 dark:text-slate-400">{formatShortDate(tx.date)}</Td>
              <Td noStackLabel>
                <p className="font-medium text-slate-800 dark:text-slate-100">{tx.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tx.reference}</p>
              </Td>
              {showBusiness && (
                <Td stackedLabel="Business">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: businesses.find((b) => b.id === tx.businessId)?.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-300">{businessName(tx.businessId)}</span>
                  </span>
                </Td>
              )}
              <Td stackedLabel="Category">
                <Badge tone="neutral">{TRANSACTION_CATEGORY_LABELS[tx.category]}</Badge>
              </Td>
              <Td stackedLabel="Amount" className="text-right">
                <span className={cn('font-display text-sm font-bold tabular-nums', tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {tx.type === 'income' ? '+' : '−'}
                  {formatCurrency(tx.amount, currency)}
                </span>
              </Td>
              <Td stackedLabel="Status">
                <Badge className={statusMeta.badgeClass}>
                  <span className={cn('mr-1 size-1.5 rounded-full', statusMeta.dotClass)} />
                  {statusMeta.label}
                </Badge>
              </Td>
              {(onEdit || onDelete) && (
                <Td stackedLabel="Actions" className="text-right">
                  <div className="inline-flex items-center gap-1">
                    {onEdit && (
                      <Button variant="ghost" size="sm" aria-label="Edit transaction" onClick={() => onEdit(tx)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete transaction"
                        className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        onClick={() => onDelete(tx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </Tr>
          )
        })}
      </TBody>
    </Table>
  )
}