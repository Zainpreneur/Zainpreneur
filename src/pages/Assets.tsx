import { Suspense } from 'react'
import { useBusinesses } from '../context/BusinessContext'
import { cn } from '../utils/cn'

export function Assets() {
  const { assets, addAsset, updateAsset, deleteAsset } = useBusinesses()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: 'hardware' as AssetCategory,
    serialNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    value: 0,
    status: 'available' as AssetStatus,
    condition: 'good' as AssetCondition,
    tag: '',
    assetOwner: 'Zainpreneur' as typeof ASSET_OWNER,
    location: '',
    notes: '',
  })

  const categories = ['hardware', 'machinery', 'equipment', 'other'] as AssetCategory[]

  const handleOpen = () => setOpen(true)
  const handleClose = () => {
    setOpen(false)
    setForm({
      name: '',
      category: 'hardware',
      serialNumber: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      value: 0,
      status: 'available',
      condition: 'good',
      tag: '',
      assetOwner: 'Zainpreneur',
      location: '',
      notes: '',
    })
  }
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  useEffect(() => {
    const tagMap: Record<AssetCategory, string> = {
      hardware: 'HW',
      machinery: 'MC',
      equipment: 'EQ',
      other: 'OT',
    }
    if (!form.tag && form.category) {
      setForm({ ...form, tag: tagMap[form.category] })
    }
  }, [form.category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.serialNumber) return
    addAsset({
      name: form.name,
      category: form.category,
      serialNumber: form.serialNumber,
      purchaseDate: form.purchaseDate,
      value: form.value,
      status: form.status,
      condition: form.condition,
      tag: form.tag,
      assetOwner: form.assetOwner,
      location: form.location,
      notes: form.notes,
    })
    handleClose()
  }

  return (
    <div>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Asset Hub</h1>

        <div className="flex gap-3">
          <button
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
          >
            <Plus className="size-4" />
            Add Asset
          </button>
        </div>

        <Suspense fallback={<div>Loading assets…</div>}>
          {open && (
            <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Add New Asset</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                      <select
                        name="category"
                        value={form.category}
                        onChange={handleSelectChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tag</label>
                      <input
                        name="tag"
                        type="text"
                        value={form.tag}
                        onChange={handleChange}
                        disabled
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm bg-slate-100 dark:bg-slate-700 dark:text-white"
                        placeholder={`Auto: ${tagMap[form.category]}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
                    <input
                      name="serialNumber"
                      type="text"
                      value={form.serialNumber}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="e.g. ZP-LT-010"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Value (₹)</label>
                      <input
                        name="value"
                        type="number"
                        value={form.value}
                        onChange={handleChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                      <select
                        name="condition"
                        value={form.condition}
                        onChange={handleSelectChange}
                        className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      >
                        <option value="new">New</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                        <option value="retired">Retired</option>
                      </select>
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
                      placeholder="e.g. HQ · Lahore"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      value={form.notes}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-300"
                      placeholder="Optional notes..."
                    ></textarea>
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
                      Create Asset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Suspense>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className={
                cn(
                  'rounded-lg border p-4 hover:border-slate-200 transition-colors',
                  asset.status === 'in-use'
                    ? 'bg-white dark:bg-slate-800'
                    : asset.status === 'maintenance'
                    ? 'bg-amber-50 dark:bg-amber-900/30'
                    : 'bg-slate-50 dark:bg-slate-900'
                )
              }
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-100 to-violet-100 text-sm font-medium">
                  {asset.tag?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2">{asset.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{asset.category}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className={cn('text-slate-600', asset.status === 'in-use' ? 'text-green-600' : asset.status === 'maintenance' ? 'text-amber-600' : 'text-red-600')}>
                  {asset.status}
                </span>
                <span>{asset.serialNumber}</span>
                <span>{asset.location || '—'}</span>
                <span>{`₹${asset.value.toLocaleString()}`}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const newStatus =
                      asset.status === 'available'
                        ? 'in-use'
                        : asset.status === 'in-use'
                        ? 'maintenance'
                        : 'available'
                    updateAsset(asset.id, { status: newStatus })
                  }}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
                >
                  Toggle Status
                </button>
                <button
                  onClick={() => deleteAsset(asset.id)}
                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-200 dark:text-red-400 dark:hover:bg-white/5 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {assets.length === 0 && (
          <p className="text-slate-500">No assets in the central pool.</p>
        )}
      </div>
    </div>
  )
}