// @ts-nocheck
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Clock, Calculator } from 'lucide-react'

import { hrApi } from '../../api/hr'
import { Button } from '../common/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card'
import { Badge } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'
import { Modal } from '../common/Modal'
import { Tabs } from '../common/Tabs'
import { Skeleton } from '../common/Skeleton'
import { Field, TextInput } from '../common/Input'

type Tab = 'contracts' | 'timesheets' | 'payroll'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function PayrollPanel() {
  const [tab, setTab] = useState<Tab>('contracts')
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showNewContract, setShowNewContract] = useState(false)
  const [showLogHours, setShowLogHours] = useState(false)
  const [showCalculate, setShowCalculate] = useState(false)
  const [payrollResult, setPayrollResult] = useState<any>(null)
  const queryClient = useQueryClient()

  const contracts = useQuery({
    queryKey: ['hr', 'contracts'],
    queryFn: () => hrApi.listContracts(),
  })

  const timesheets = useQuery({
    queryKey: ['hr', 'timesheets', periodMonth],
    queryFn: () => hrApi.listTimesheets({ periodMonth }),
  })

  const contractList = contracts.data?.data ?? contracts.data ?? []
  const timesheetList = timesheets.data?.data ?? timesheets.data ?? []

  const createContract = useMutation({
    mutationFn: (draft: any) => hrApi.createContract(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'contracts'] })
      setShowNewContract(false)
    },
  })

  const logTimesheet = useMutation({
    mutationFn: (input: any) => hrApi.logTimesheet(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'timesheets'] })
      setShowLogHours(false)
    },
  })

  const calculatePayroll = useMutation({
    mutationFn: (input: any) => hrApi.calculatePayroll(input),
    onSuccess: (data) => {
      setPayrollResult(data?.data ?? data)
      setShowCalculate(false)
    },
  })

  const postPayroll = useMutation({
    mutationFn: (run: any) => hrApi.postPayrollRun(run),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr'] })
      setPayrollResult(null)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">Payroll</h2>
        <div className="flex gap-2">
          {tab === 'contracts' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setShowNewContract(true)}>
              New Contract
            </Button>
          )}
          {tab === 'timesheets' && (
            <Button icon={<Plus className="size-4" />} onClick={() => setShowLogHours(true)}>
              Log Hours
            </Button>
          )}
          {tab === 'payroll' && (
            <Button icon={<Calculator className="size-4" />} onClick={() => setShowCalculate(true)}>
              Calculate Payroll
            </Button>
          )}
        </div>
      </div>

      <Tabs
        options={[
          { value: 'contracts', label: 'Contracts', count: contractList.length },
          { value: 'timesheets', label: 'Timesheets', count: timesheetList.length },
          { value: 'payroll', label: 'Payroll' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Contracts Tab */}
      {tab === 'contracts' && (
        <div>
          {contracts.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-[22px]" />
              ))}
            </div>
          ) : contractList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contracts yet"
              description="Create an employment contract to get started."
              action={<Button onClick={() => setShowNewContract(true)}>New Contract</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contractList.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">
                        {c.employeeName ?? c.name ?? 'Employee'}
                      </p>
                      <Badge tone="info">{c.type ?? 'Full-time'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Rate: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(c.hourlyRate ?? 0)}/hr</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Started {c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timesheets Tab */}
      {tab === 'timesheets' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Clock className="size-5" />
              </span>
              <CardTitle>Timesheets</CardTitle>
            </div>
            <div className="ml-auto">
              <TextInput
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="!h-9 !w-44"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {timesheets.isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : timesheetList.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No timesheets for this period"
                description="Log hours to start tracking time."
                action={<Button onClick={() => setShowLogHours(true)}>Log Hours</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Employee</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Date</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Hours</th>
                      <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetList.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{t.employeeName ?? t.employeeId ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.date ? new Date(t.date).toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{t.hours ?? '—'}</td>
                        <td className="px-5 py-3">
                          <Badge tone={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'danger' : 'warning'}>
                            {t.status ?? 'pending'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll Tab */}
      {tab === 'payroll' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                <Calculator className="size-5" />
              </span>
              <CardTitle>Payroll</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!payrollResult ? (
              <EmptyState
                icon={Calculator}
                title="No payroll calculated"
                description="Calculate payroll for the current period to see results."
                action={<Button onClick={() => setShowCalculate(true)}>Calculate Payroll</Button>}
              />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">Employee</th>
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Hours</th>
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Rate</th>
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Gross Pay</th>
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Deductions</th>
                        <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollResult.employees ?? payrollResult.lines ?? payrollResult ?? []).map((line: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{line.employeeName ?? line.employeeId ?? '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{line.hours ?? 0}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmt(line.hourlyRate ?? line.rate ?? 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{fmt(line.grossPay ?? 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{fmt(line.deductions ?? 0)}</td>
                          <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmt(line.netPay ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="success"
                    disabled={postPayroll.isPending}
                    onClick={() => postPayroll.mutate(payrollResult)}
                  >
                    {postPayroll.isPending ? 'Posting…' : 'Post Payroll'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Contract Modal */}
      <Modal
        open={showNewContract}
        onClose={() => setShowNewContract(false)}
        title="New Contract"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewContract(false)}>Cancel</Button>
            <Button
              disabled={createContract.isPending}
              onClick={() => {
                const form = document.getElementById('new-contract-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                createContract.mutate({
                  employeeName: fd.get('employeeName'),
                  type: fd.get('type'),
                  hourlyRate: Number(fd.get('hourlyRate')),
                  startDate: fd.get('startDate'),
                })
              }}
            >
              {createContract.isPending ? 'Creating…' : 'Create Contract'}
            </Button>
          </>
        }
      >
        <form id="new-contract-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Employee Name" required>
            <TextInput name="employeeName" placeholder="John Doe" />
          </Field>
          <Field label="Contract Type" required>
            <TextInput name="type" placeholder="Full-time / Part-time / Contractor" />
          </Field>
          <Field label="Hourly Rate" required>
            <TextInput name="hourlyRate" type="number" placeholder="0.00" step="0.01" min="0" />
          </Field>
          <Field label="Start Date" required>
            <TextInput name="startDate" type="date" />
          </Field>
        </form>
      </Modal>

      {/* Log Hours Modal */}
      <Modal
        open={showLogHours}
        onClose={() => setShowLogHours(false)}
        title="Log Hours"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLogHours(false)}>Cancel</Button>
            <Button
              disabled={logTimesheet.isPending}
              onClick={() => {
                const form = document.getElementById('log-hours-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                logTimesheet.mutate({
                  employeeId: fd.get('employeeId'),
                  date: fd.get('date'),
                  hours: Number(fd.get('hours')),
                  notes: fd.get('notes'),
                })
              }}
            >
              {logTimesheet.isPending ? 'Logging…' : 'Log Hours'}
            </Button>
          </>
        }
      >
        <form id="log-hours-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Employee ID" required>
            <TextInput name="employeeId" placeholder="Employee ID" />
          </Field>
          <Field label="Date" required>
            <TextInput name="date" type="date" />
          </Field>
          <Field label="Hours" required>
            <TextInput name="hours" type="number" placeholder="8" step="0.25" min="0" />
          </Field>
          <Field label="Notes">
            <TextInput name="notes" placeholder="Optional notes" />
          </Field>
        </form>
      </Modal>

      {/* Calculate Payroll Modal */}
      <Modal
        open={showCalculate}
        onClose={() => setShowCalculate(false)}
        title="Calculate Payroll"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCalculate(false)}>Cancel</Button>
            <Button
              disabled={calculatePayroll.isPending}
              onClick={() => {
                const form = document.getElementById('calc-payroll-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                calculatePayroll.mutate({
                  periodMonth: fd.get('periodMonth'),
                })
              }}
            >
              {calculatePayroll.isPending ? 'Calculating…' : 'Calculate'}
            </Button>
          </>
        }
      >
        <form id="calc-payroll-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label="Period Month" required>
            <TextInput name="periodMonth" type="month" defaultValue={periodMonth} />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
