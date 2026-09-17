import type { ActivityEvent, Task } from '../types'

export const tasks: Task[] = [
  // Apex AutoSpa
  { id: 'task-001', businessId: 'biz-apex-autospa', title: 'Renegotiate ceramic coating supplier contract', description: 'Current per-unit cost is 12% above market. Get 3 quotes before the quarterly restock.', status: 'in_progress', priority: 'high', dueDate: '2026-09-22', tags: ['suppliers', 'costs'], createdAt: '2026-09-01T09:00:00Z' },
  { id: 'task-002', businessId: 'biz-apex-autospa', title: 'Launch fleet-valeting microsite', description: 'Landing page for the Zoom Motors contract to win 2 more dealerships in Q4.', status: 'todo', priority: 'medium', dueDate: '2026-09-28', tags: ['growth', 'B2B'], createdAt: '2026-09-05T09:00:00Z' },
  { id: 'task-003', businessId: 'biz-apex-autospa', title: 'Review member churn cohort', description: 'Membership churn ticked to 4.1% in Aug. Analyse exit reasons and design a win-back flow.', status: 'review', priority: 'urgent', dueDate: '2026-09-19', tags: ['memberships', 'retention'], createdAt: '2026-08-27T09:00:00Z' },
  { id: 'task-004', businessId: 'biz-apex-autospa', title: 'Hire second detailer (ceramics certified)', description: 'Approve JD and post role; target 30 days to onboard given scaling demand.', status: 'in_progress', priority: 'medium', dueDate: '2026-10-02', tags: ['hiring', 'team'], createdAt: '2026-09-08T09:00:00Z' },

  // Luxe Laundry
  { id: 'task-005', businessId: 'biz-luxe-laundry', title: 'Route density review — Model Town cluster', description: 'Consolidate 2 overlapping routes into 1 to cut rider cost 18%.', status: 'in_progress', priority: 'high', dueDate: '2026-09-21', tags: ['logistics', 'costs'], createdAt: '2026-09-03T09:00:00Z' },
  { id: 'task-006', businessId: 'biz-luxe-laundry', title: 'Dry-cleaning atelier pricing table v2', description: 'New pricing after chemical supplier switch; update app + print QR cards.', status: 'todo', priority: 'low', dueDate: '2026-09-30', tags: ['pricing'], createdAt: '2026-09-06T09:00:00Z' },
  { id: 'task-007', businessId: 'biz-luxe-laundry', title: 'Quarterly app health check', description: 'Review crash-free rate, top funnel drop-offs and push-notification opt-in stats.', status: 'done', priority: 'medium', dueDate: '2026-09-08', tags: ['product', 'app'], createdAt: '2026-09-01T09:00:00Z', completedAt: '2026-09-08T16:00:00Z' },

  // Gearhead Motors
  { id: 'task-008', businessId: 'biz-gearhead-motors', title: 'Finish inventory clearance pricing', description: 'Tag remaining SKUs at clearance prices; publish WhatsApp catalogue by Friday.', status: 'in_progress', priority: 'high', dueDate: '2026-09-18', tags: ['inventory', 'winding down'], createdAt: '2026-09-10T09:00:00Z' },
  { id: 'task-009', businessId: 'biz-gearhead-motors', title: 'Transfer workshop lease to new tenant', description: 'Coordinate handover with landlord and the buyer of the lease.', status: 'todo', priority: 'urgent', dueDate: '2026-09-26', tags: ['legal', 'winding down'], createdAt: '2026-09-09T09:00:00Z' },
  { id: 'task-010', businessId: 'biz-gearhead-motors', title: 'Close vendor accounts & settle dues', description: 'Final settlement with 3 parts distributors; keep invoices for records.', status: 'done', priority: 'medium', dueDate: '2026-09-05', tags: ['finance', 'winding down'], createdAt: '2026-08-28T09:00:00Z', completedAt: '2026-09-05T13:00:00Z' },

  // MobiCom Solutions
  { id: 'task-011', businessId: 'biz-mobicom', title: 'Q4 flagship store inventory plan', description: 'Forecast iPhone + accessory mix; lock orders to hit Black Friday targets.', status: 'in_progress', priority: 'urgent', dueDate: '2026-09-25', tags: ['inventory', 'Q4'], createdAt: '2026-09-04T09:00:00Z' },
  { id: 'task-012', businessId: 'biz-mobicom', title: 'ERP v2 roadmap — billing module', description: 'Scope multi-branch billing with the retail partners; share draft spec.', status: 'todo', priority: 'high', dueDate: '2026-10-10', tags: ['ERP', 'product'], createdAt: '2026-09-07T09:00:00Z' },
  { id: 'task-013', businessId: 'biz-mobicom', title: 'Shareholder update — September', description: 'Prepare monthly P&L and store-level EBITDA pack for partners.', status: 'review', priority: 'medium', dueDate: '2026-09-23', tags: ['reporting'], createdAt: '2026-09-11T09:00:00Z' },

  // CloudSpoon Kitchens
  { id: 'task-014', businessId: 'biz-cloudspoon', title: '3rd city — site due diligence', description: 'Visit shortlisted kitchen locations; validate delivery radius and permit status.', status: 'in_progress', priority: 'urgent', dueDate: '2026-09-20', tags: ['expansion'], createdAt: '2026-09-02T09:00:00Z' },
  { id: 'task-015', businessId: 'biz-cloudspoon', title: 'Cut ingredient waste 5% by month-end', description: 'Kitchen-level waste logs revealed trim waste spike; run daily prep huddles.', status: 'todo', priority: 'high', dueDate: '2026-09-29', tags: ['ops', 'costs'], createdAt: '2026-09-06T09:00:00Z' },
  { id: 'task-016', businessId: 'biz-cloudspoon', title: 'Reconcile delivery platform invoices', description: 'Fee discrepancies detected on two brands; raise dispute with platform manager.', status: 'done', priority: 'medium', dueDate: '2026-09-09', tags: ['finance'], createdAt: '2026-08-30T09:00:00Z', completedAt: '2026-09-09T11:00:00Z' },

  // Stride Sportswear
  { id: 'task-017', businessId: 'biz-stride-sportswear', title: 'October campaign plan — winter line', description: 'Creative assets, budget split and landing pages for the winter drop.', status: 'todo', priority: 'high', dueDate: '2026-09-27', tags: ['marketing', 'campaign'], createdAt: '2026-09-09T09:00:00Z' },
  { id: 'task-018', businessId: 'biz-stride-sportswear', title: 'Client dashboard refresh', description: 'Add cost-per-acquisition and return on ad spend to the monthly client report.', status: 'review', priority: 'medium', dueDate: '2026-09-24', tags: ['reporting', 'client'], createdAt: '2026-09-05T09:00:00Z' },
  { id: 'task-019', businessId: 'biz-stride-sportswear', title: 'Renew 2 underperforming creator deals', description: 'Reconfirmed CPE above target — negotiate renewals or cut from the mix.', status: 'done', priority: 'low', dueDate: '2026-09-04', tags: ['influencers'], createdAt: '2026-08-26T09:00:00Z', completedAt: '2026-09-03T15:00:00Z' },

  // Craft Coffee Roasters
  { id: 'task-020', businessId: 'biz-craft-coffee', title: 'Third café systems blueprint', description: 'POS, inventory and staff role matrix for the upcoming third outlet.', status: 'todo', priority: 'medium', dueDate: '2026-10-05', tags: ['expansion', 'systems'], createdAt: '2026-09-08T09:00:00Z' },
  { id: 'task-021', businessId: 'biz-craft-coffee', title: 'Barista certification — cohort 4', description: 'Schedule, workbooks and practical stations; coordinate with the owner.', status: 'in_progress', priority: 'medium', dueDate: '2026-09-30', tags: ['training'], createdAt: '2026-09-03T09:00:00Z' },
  { id: 'task-022', businessId: 'biz-craft-coffee', title: 'Supplier contract renegotiation summary', description: 'Present coffee-bean supplier savings options to the owner for sign-off.', status: 'done', priority: 'high', dueDate: '2026-09-10', tags: ['suppliers'], createdAt: '2026-08-29T09:00:00Z', completedAt: '2026-09-10T12:00:00Z' },

  // Nova Fitness Studios
  { id: 'task-023', businessId: 'biz-nova-fitness', title: 'Studio 2 launch timeline — milestone 2', description: 'Member pre-sale plan, instructor hiring, and fit-out checkpoints.', status: 'in_progress', priority: 'urgent', dueDate: '2026-09-22', tags: ['expansion', 'launch'], createdAt: '2026-09-01T09:00:00Z' },
  { id: 'task-024', businessId: 'biz-nova-fitness', title: 'Member churn playbook for studio 1', description: 'Standardise the win-back sequence for lapse members before scaling to studio 2.', status: 'todo', priority: 'medium', dueDate: '2026-09-28', tags: ['retention'], createdAt: '2026-09-06T09:00:00Z' },
  { id: 'task-025', businessId: 'biz-nova-fitness', title: 'Final report — milestone 1 deliverables', description: 'Compile systems rollout report; invoice client for milestone 1.', status: 'review', priority: 'high', dueDate: '2026-09-19', tags: ['reporting', 'billing'], createdAt: '2026-09-07T09:00:00Z' },
]

export const activity: ActivityEvent[] = [
  { id: 'act-001', businessId: 'biz-apex-autospa', type: 'milestone', message: 'Passed 200 active memberships', timestamp: '2026-09-14T10:00:00Z' },
  { id: 'act-002', businessId: 'biz-luxe-laundry', type: 'transaction', message: 'New payout batch of ₨244,800 cleared', timestamp: '2026-09-15T08:30:00Z' },
  { id: 'act-003', businessId: 'biz-mobicom', type: 'milestone', message: 'ERP surpassed 12,000 monthly orders processed', timestamp: '2026-09-13T14:00:00Z' },
  { id: 'act-004', businessId: 'biz-cloudspoon', type: 'task', message: 'Site due diligence scheduled for 3rd city', timestamp: '2026-09-12T09:20:00Z' },
  { id: 'act-005', businessId: 'biz-stride-sportswear', type: 'business', message: 'October campaign plan kicked off', timestamp: '2026-09-11T11:00:00Z' },
  { id: 'act-006', businessId: 'biz-gearhead-motors', type: 'milestone', message: 'Workshop lease handover confirmed with new tenant', timestamp: '2026-09-10T16:00:00Z' },
  { id: 'act-007', businessId: 'biz-nova-fitness', type: 'task', message: 'Milestone 1 deliverables marked for review', timestamp: '2026-09-09T13:40:00Z' },
  { id: 'act-008', businessId: 'biz-craft-coffee', type: 'milestone', message: 'Barista certification cohort 4 opened', timestamp: '2026-09-08T10:15:00Z' },
  { id: 'act-009', businessId: 'biz-apex-autospa', type: 'transaction', message: 'Ceramic coating package sold (₨48,000)', timestamp: '2026-09-14T17:20:00Z' },
  { id: 'act-010', businessId: 'biz-mobicom', type: 'business', message: 'Published shareholder update pack', timestamp: '2026-09-10T09:30:00Z' },
  { id: 'act-011', businessId: 'biz-luxe-laundry', type: 'milestone', message: 'Hit 612 active subscription plans', timestamp: '2026-09-11T08:00:00Z' },
  { id: 'act-012', businessId: 'biz-stride-sportswear', type: 'transaction', message: 'New client dashboard delivered to brand team', timestamp: '2026-09-09T15:00:00Z' },
]