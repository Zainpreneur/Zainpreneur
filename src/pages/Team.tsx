import { Suspense } from 'react'
import { useBusinesses } from '../context/BusinessContext'
import { cn } from '../utils/cn'

export function Team() {
  const { teamMembers, addTeamMember, updateTeamMember, deleteTeamMember } = useBusinesses()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    department: 'Operations' as string,
    employmentType: 'full_time' as EmploymentType,
    activeBusinessId: '',
    branchId: '',
    location: '',
    startedAt: new Date().toISOString().split('T')[0],
    monthlyCost: 0,
    skills: [],
    color: '#6366f1',
  })

  const employmentTypes = ['full_time', 'part_time', 'contract'] as EmploymentType[]

  const handleOpen = () => setOpen(true)
  const handleClose = () => {
    setOpen(false)
    setForm({
      name: '',
      role: '',
      email: '',
      phone: '',
      department: 'Operations',
      employmentType: 'full_time',
      activeBusinessId: '',
      branchId: '',
      location: '',
      startedAt: new Date().toISOString().split('T')[0],
      monthlyCost: 0,
      skills: [],
      color: '#6366f1',
    })
  }
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })
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
    addTeamMember({
      name: form.name,
      role: form.role,
      email: form.email,
      phone: form.phone,
      department: form.department,
      employmentType: form.employmentType,
      activeBusinessId: form.activeBusinessId,
      branchId: form.branchId,
      location: form.location,
      startedAt: form.startedAt,
      monthlyCost: form.monthlyCost,
      skills: form.skills,
      color: form.color,
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
                      <option value="Leadership">Leadership</option>
                      <option value="Operations">Operations</option>
                      <option value="Growth">Growth</option>
                      <option value="Finance">Finance</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Field Ops">Field Ops</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type</label>
                      <select
                        name="employmentType"
                        value={form.employmentType}
                        onChange={handleSelectChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      >
                        <option value="full_time">Full-time</option>
                        <option value="part_time">Part-time</option>
                        <option value="contract">Contract</option>
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
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <input
                      name="location"
                      type="text"
                      value={form.location}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="e.g. DHA, Lahore"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Business</label>
                    <select
                      name="activeBusinessId"
                      value={form.activeBusinessId}
                      onChange={handleSelectChange}
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                    >
                      <option value="">None (Pool)</option>
                      {/* Business options would be populated here */}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma-separated)</label>
                    <textarea
                      name="skills"
                      rows={3}
                      value={form.skills.join(', ')}
                      onChange={(e) => setForm({ ...form, skills: e.target.value.split(',').map((s) => s.trim()).filter((s) => s) })}
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
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className={
                cn(
                  'rounded-lg border p-4 hover:border-slate-200 transition-colors',
                  member.employmentType === 'full_time'
                    ? 'bg-white dark:bg-slate-800'
                    : 'bg-slate-50 dark:bg-slate-900'
                )
              }
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-100 to-violet-100 text-sm font-medium">
                  {member.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2">{member.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{member.role}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="text-slate-600">{member.department}</span>
                <span>{member.employmentType}</span>
                <span>{member.location || '—'}</span>
                <span>{`₹${member.monthlyCost?.toLocaleString() || '—'}`}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const newEmployment =
                      member.employmentType === 'full_time'
                        ? 'part_time'
                        : member.employmentType === 'part_time'
                        ? 'contract'
                        : 'full_time'
                    updateTeamMember(member.id, { employmentType: newEmployment })
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
                >
                  Change Type
                </button>
                <button
                  onClick={() => deleteTeamMember(member.id)}
                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-white/5 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        {teamMembers.length === 0 && (
          <p className="text-slate-500">No team members found.</p>
        )}
      </div>
    </div>
  )
}