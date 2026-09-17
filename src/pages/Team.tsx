import { Suspense } from 'react'
import { useBusinesses } from '../context/BusinessContext'
import { cn } from '../utils/cn'

export function Team() {
  const { teamMembers, addTeamMember, updateTeamMember, deleteTeamMember, partnerAgencies } = useBusinesses()

  // Segment team members by engagement type
  const internalMembers = React.useMemo(() =>
    teamMembers.filter((m) => m.engagementType === 'internal'),
    [teamMembers],
  )
  const freelancerMembers = React.useMemo(() =>
    teamMembers.filter((m) => m.engagementType === 'freelancer'),
    [teamMembers],
  )
  const agencyMemberMap = React.useMemo(() => {
    const map: Record<string, PartnerAgency> = {}
    partnerAgencies.forEach((agency) => {
      ;(agency.activeAllocations || []).forEach((busId) => {
        map[busId] = agency
      })
    })
    return map
  }, [partnerAgencies])

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    department: 'Operations' as string,
    engagementType: 'internal' as EngagementType,
    activeBusinessId: '' as string,
    branchId: '' as string,
    location: '',
    startedAt: new Date().toISOString().split('T')[0],
    monthlyCost: 0,
    hourlyRate: 0 as number,
    contractValue: 0 as number,
    contractTerms: '' as string,
    skills: [] as string[],
    color: '#6366f1',
    partnerName: '' as string,
    partnerContact: '' as string,
  })

  const engagementTypes = ['internal', 'freelancer', 'agency_partner'] as EngagementType[]
  const departments = [
    'Leadership',
    'Operations',
    'Growth',
    'Finance',
    'Engineering',
    'Field Ops',
  ] as string[]

  const handleOpen = () => setOpen(true)
  const handleClose = () => {
    setOpen(false)
    setForm({
      name: '',
      role: '',
      email: '',
      phone: '',
      department: 'Operations',
      engagementType: 'internal',
      activeBusinessId: '',
      branchId: '',
      location: '',
      startedAt: new Date().toISOString().split('T')[0],
      monthlyCost: 0,
      hourlyRate: 0,
      contractValue: 0,
      contractTerms: '',
      skills: [],
      color: '#6366f1',
      partnerName: '',
      partnerContact: '',
    })
  }
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target as any
    setForm({ ...form, [name]: value })
  }
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills || [],
    }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.role) return

    const engagement: TeamMemberEngagementDetail = {
      type: form.engagementType,
      cost: form.engagementType === 'internal'
        ? form.monthlyCost
        : form.engagementType === 'freelancer'
        ? form.hourlyRate
        : form.contractValue,
      details: form.engagementType === 'internal'
        ? { department: form.department, location: form.location }
        : form.engagementType === 'freelancer'
        ? { hourlyRate: form.hourlyRate, contractTerms: form.contractTerms }
        : { partnerName: form.partnerName, contractValue: form.contractValue },
    }

    addTeamMember({
      name: form.name,
      role: form.role,
      email: form.email,
      phone: form.phone,
      department: form.department,
      engagementType: form.engagementType,
      activeBusinessId: form.activeBusinessId || undefined,
      branchId: form.branchId || undefined,
      location: form.location,
      startedAt: form.startedAt,
      skills: form.skills,
      color: form.color,
      engagement,
      assignedAssets: [],
    })
    handleClose()
  }

  return (
    <div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Team & Resource Management</h1>

        <div className="flex gap-3">
          <button
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
          >
            <UserPlus className="size-4" />
            Add Team Member
          </button>
        </div>

        <Suspense fallback={<div>Loading team…</div>}>
          {open && (
            <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Add New Team Member</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <input
                      name="role"
                      type="text"
                      value={form.role}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="e.g. Operations Manager"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        placeholder="+92 300 111 2233"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                    <select
                      name="department"
                      value={form.department}
                      onChange={handleSelectChange}
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                    >
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Engagement Type</label>
                      <select
                        name="engagementType"
                        value={form.engagementType}
                        onChange={handleSelectChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      >
                        {engagementTypes.map((engType) => (
                          <option key={engType} value={engType}>
                            {ENGAGEMENT_TYPE_LABELS[engType]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Cost (₹)</label>
                      <input
                        name="monthlyCost"
                        type="number"
                        value={form.monthlyCost}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        min={0}
                      />
                    </div>
                  </div>
                  {form.engagementType === 'freelancer' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (₹)</label>
                      <input
                        name="hourlyRate"
                        type="number"
                        value={form.hourlyRate}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        min={0}
                        placeholder="e.g. 2500"
                      />
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contract Terms</label>
                      <textarea
                        name="contractTerms"
                        rows={3}
                        value={form.contractTerms}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        placeholder="e.g. 20hrs/week, 3-month retainer"
                      ></textarea>
                    </div>
                  )}
                  {form.engagementType === 'agency_partner' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Partner Name</label>
                        <input
                          name="partnerName"
                          type="text"
                          value={form.partnerName}
                          onChange={handleChange}
                          className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                          placeholder="e.g. Odoo Partner Agency"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contract Value (₹)</label>
                        <input
                          name="contractValue"
                          type="number"
                          value={form.contractValue}
                          onChange={handleChange}
                          className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                          min={0}
                        />
                      </div>
                    </div>
                  )}
                  {form.engagementType === 'internal' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Department</label>
                      <select
                        name="department"
                        value={form.department}
                        onChange={handleSelectChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      >
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                      <input
                        name="location"
                        type="text"
                        value={form.location}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus-border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                        placeholder="e.g. DHA, Lahore"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma-separated)</label>
                    <textarea
                      name="skills"
                      rows={3}
                      value={form.skills.join(', ')}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          skills: (e.target.value as string)
                            .split(',')
                            .map((s: string) => s.trim())
                            .filter((s: string) => s),
                        })
                      }
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="e.g. Strategy, Finance, Operations"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                    <input
                      name="color"
                      type="color"
                      value={form.color}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2.5 p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
                    >
                      Add Team Member
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Suspense>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Internal Staff Section */}
          <div>
            <h2 className="text-lg font-medium text-slate-600 mb-3">Internal Staff</h2>
            {internalMembers.length === 0 && (
              <p className="text-slate-500 text-sm">No internal staff found.</p>
            )}
            {internalMembers.map((member) => (
              <div
                key={member.id}
                className={
                  cn(
                    'rounded-lg border p-4 hover:border-slate-200 transition-colors',
                    member.engagementType === 'internal'
                      ? 'bg-white dark:bg-slate-800'
                      : 'bg-slate-50 dark:bg-slate-900'
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100 text-sm font-medium">
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{member.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{member.role}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="text-slate-600">Dept: {member.department}</span>
                  <span>{member.engagementType === 'internal' ? 'Full-time' : ''}</span>
                  <span>{member.location || '—'}</span>
                  <span>{`₹${member.engagement.cost?.toLocaleString() || '—'}`}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
      const newEmployment =
        member.engagementType === 'internal'
          ? 'part_time'
          : member.engagementType === 'part_time'
          ? 'contract'
          : 'internal'
      updateTeamMember(member.id, { engagementType: newEmployment })
    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
                    title="Change engagement type"
                  >
                    Change Type
                  </button>
                  <button
                    onClick={() => deleteTeamMember(member.id)}
                    className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-white/5 transition-colors"
                    title="Remove member"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Freelancers Section */}
          <div>
            <h2 className="text-lg font-medium text-slate-600 mb-3">Freelancers</h2>
            {freelancerMembers.length === 0 && (
              <p className="text-slate-500 text-sm">No freelancers found.</p>
            )}
            {freelancerMembers.map((member) => (
              <div
                key={member.id}
                className={
                  cn(
                    'rounded-lg border p-4 hover:border-slate-200 transition-colors',
                    member.engagementType === 'freelancer'
                      ? 'bg-white dark:bg-slate-800'
                      : 'bg-slate-50 dark:bg-slate-900'
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-100 to-green-100 text-sm font-medium">
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{member.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{member.role}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="text-slate-600">Hourly: ₹{member.engagement.cost || '—'}</span>
                  <span>{member.engagement.details?.contractTerms || '—'}</span>
                  <span>{member.location || '—'}</span>
                  <span>{`₹${member.engagement.cost?.toLocaleString() || '—'}`}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
      const newEmployment =
        member.engagementType === 'freelancer'
          ? 'contract'
          : member.engagementType === 'contract'
          ? 'intern'
          : 'freelancer'
      updateTeamMember(member.id, { engagementType: newEmployment })
    }}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
                    title="Change engagement type"
                  >
                    Change Type
                  </button>
                  <button
                    onClick={() => deleteTeamMember(member.id)}
                    className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-white/5 transition-colors"
                    title="Remove member"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Agency Partners Section */}
          <div>
            <h2 className="text-lg font-medium text-slate-600 mb-3">Agency Partners</h2>
            {partnerAgencies.length === 0 && (
              <p className="text-slate-500 text-sm">No agency partners found.</p>
            )}
            {partnerAgencies.map((agency) => (
              <div
                key={agency.id}
                className={
                  cn(
                    'rounded-lg border p-4 hover:border-slate-200 transition-colors',
                    agency.status === 'active'
                      ? 'bg-white dark:bg-slate-800'
                      : 'bg-amber-50 dark:bg-amber-900/30'
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-sm font-medium">
                    {agency.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{agency.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{agency.contactName}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-600">Contract: ₹${agency.contractValue.toLocaleString()}</span>
                  <span>{agency.status}</span>
                  <span>{agency.activeAllocations?.length || 0} active businesses</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => deleteTeamMember(agency.id)}
                    className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-white/5 transition-colors"
                    title="Remove partner"
                  >
                    Remove
                  </button>
                </div>
                {agency.activeAllocations?.length > 0 && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-md text-xs text-slate-400">
                    <strong>Assigned to businesses:</strong> {agency.activeAllocations
                      .map((busId) => {
                        const biz = businesses.find((b) => b.id === busId)
                        return biz ? biz.name : busId
                      })
                      .join(', ') || '—'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {teamMembers.length === 0 && partnerAgencies.length === 0 && (
          <p className="text-slate-500">No team members or agency partners found.</p>
        )}
      </div>
    </div>
  )
}