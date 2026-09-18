import type { Transaction } from '../types'

export const transactions: Transaction[] = [
  // ——— Apex AutoSpa ———
  { id: 'tx-001', businessId: 'biz-apex-autospa', date: '2026-09-14', description: 'Ceramic coating package (BMW X5)', category: 'revenue', type: 'income', amount: 48000, paymentMethod: 'Card', reference: 'INV-AA-0941', status: 'cleared', notes: 'Premium package, 3-year warranty' },
  { id: 'tx-002', businessId: 'biz-apex-autospa', date: '2026-09-12', description: 'Membership revenue batch — 214 active plans', category: 'revenue', type: 'income', amount: 320000, paymentMethod: 'Bank transfer', reference: 'INV-AA-0938', status: 'cleared' },
  { id: 'tx-003', businessId: 'biz-apex-autospa', date: '2026-09-10', description: 'Ceramic coating chemical restock', category: 'inventory', type: 'expense', amount: 185000, paymentMethod: 'Bank transfer', reference: 'PO-AA-0712', status: 'pending', notes: 'Quarterly stock from same supplier' },
  { id: 'tx-004', businessId: 'biz-apex-autospa', date: '2026-08-29', description: 'Fleet valeting — Zoom Motors dealership', category: 'revenue', type: 'income', amount: 96000, paymentMethod: 'Bank transfer', reference: 'INV-AA-0925', status: 'cleared', notes: '24 cars, monthly contract' },
  { id: 'tx-005', businessId: 'biz-apex-autospa', date: '2026-08-18', description: 'Payroll — 14 staff (Sep cycle pre-pay)', category: 'payroll', type: 'expense', amount: 610000, paymentMethod: 'Payroll', reference: 'PAY-AA-0811', status: 'cleared' },
  { id: 'tx-006', businessId: 'biz-apex-autospa', date: '2026-08-05', description: 'Facility water & electricity', category: 'utilities', type: 'expense', amount: 74000, paymentMethod: 'Bank transfer', reference: 'UTL-AA-0809', status: 'cleared' },
  { id: 'tx-007', businessId: 'biz-apex-autospa', date: '2026-07-22', description: 'Instagram & Google Ads — July', category: 'marketing', type: 'expense', amount: 89000, paymentMethod: 'Card', reference: 'MKT-AA-0715', status: 'flagged', notes: 'CPL higher than target — review audience' },

  // ——— Luxe Laundry ———
  { id: 'tx-008', businessId: 'biz-luxe-laundry', date: '2026-09-15', description: 'Weekly subscription batch — 612 plans', category: 'revenue', type: 'income', amount: 244800, paymentMethod: 'Card', reference: 'INV-LX-1201', status: 'cleared' },
  { id: 'tx-009', businessId: 'biz-luxe-laundry', date: '2026-09-08', description: 'Dry-cleaning atelier revenue', category: 'revenue', type: 'income', amount: 68000, paymentMethod: 'Cash', reference: 'INV-LX-1188', status: 'pending' },
  { id: 'tx-010', businessId: 'biz-luxe-laundry', date: '2026-09-04', description: 'Detergents & softener bulk order', category: 'inventory', type: 'expense', amount: 96000, paymentMethod: 'Bank transfer', reference: 'PO-LX-0852', status: 'cleared' },
  { id: 'tx-011', businessId: 'biz-luxe-laundry', date: '2026-08-26', description: 'Rider fuel & bike maintenance pool', category: 'operations', type: 'expense', amount: 38000, paymentMethod: 'Bank transfer', reference: 'EXP-LX-0843', status: 'cleared' },
  { id: 'tx-012', businessId: 'biz-luxe-laundry', date: '2026-08-11', description: 'Payroll — 9 staff', category: 'payroll', type: 'expense', amount: 265000, paymentMethod: 'Payroll', reference: 'PAY-LX-0822', status: 'cleared' },
  { id: 'tx-013', businessId: 'biz-luxe-laundry', date: '2026-07-30', description: 'Mobile app subscription revenue (split)', category: 'revenue', type: 'income', amount: 31200, paymentMethod: 'Card', reference: 'INV-LX-1150', status: 'cleared', notes: 'App store payout, net of fees' },

  // ——— Gearhead Motors ———
  { id: 'tx-014', businessId: 'biz-gearhead-motors', date: '2026-09-11', description: 'Parts inventory — final supplier clearance sale', category: 'inventory', type: 'income', amount: 128000, paymentMethod: 'Cash', reference: 'INV-GM-0341', status: 'cleared', notes: 'Selling down remaining stock' },
  { id: 'tx-015', businessId: 'biz-gearhead-motors', date: '2026-09-06', description: 'Diagnostics & tune-up services (week 1)', category: 'revenue', type: 'income', amount: 42000, paymentMethod: 'Mixed', reference: 'INV-GM-0338', status: 'cleared' },
  { id: 'tx-016', businessId: 'biz-gearhead-motors', date: '2026-08-25', description: 'Shop rent — final 2 months', category: 'rent', type: 'expense', amount: 90000, paymentMethod: 'Bank transfer', reference: 'RENT-GM-0512', status: 'cleared' },
  { id: 'tx-017', businessId: 'biz-gearhead-motors', date: '2026-08-12', description: 'Payroll — 4 staff', category: 'payroll', type: 'expense', amount: 180000, paymentMethod: 'Payroll', reference: 'PAY-GM-0433', status: 'cleared' },
  { id: 'tx-018', businessId: 'biz-gearhead-motors', date: '2026-07-18', description: 'Parting-out sale — donor bikes', category: 'revenue', type: 'income', amount: 54000, paymentMethod: 'Cash', reference: 'INV-GM-0329', status: 'cleared' },

  // ——— MobiCom Solutions ———
  { id: 'tx-019', businessId: 'biz-mobicom', date: '2026-09-15', description: 'Revenue share — Q3 sales (22% stake)', category: 'revenue', type: 'income', amount: 310000, paymentMethod: 'Bank transfer', reference: 'REV-MC-Q3', status: 'cleared', notes: 'Quarterly distribution from partner entity' },
  { id: 'tx-020', businessId: 'biz-mobicom', date: '2026-09-09', description: 'ERP licence renewals — 3 retailers', category: 'revenue', type: 'income', amount: 150000, paymentMethod: 'Bank transfer', reference: 'INV-MC-0719', status: 'cleared' },
  { id: 'tx-021', businessId: 'biz-mobicom', date: '2026-09-02', description: 'iPhone stock purchase — flagship store', category: 'inventory', type: 'expense', amount: 4200000, paymentMethod: 'Bank transfer', reference: 'PO-MC-1120', status: 'pending' },
  { id: 'tx-022', businessId: 'biz-mobicom', date: '2026-08-27', description: 'Store payroll — 32 staff', category: 'payroll', type: 'expense', amount: 1610000, paymentMethod: 'Payroll', reference: 'PAY-MC-1044', status: 'cleared' },
  { id: 'tx-023', businessId: 'biz-mobicom', date: '2026-08-14', description: 'Mall lease — Fortress store', category: 'rent', type: 'expense', amount: 620000, paymentMethod: 'Bank transfer', reference: 'RENT-MC-0231', status: 'cleared' },
  { id: 'tx-024', businessId: 'biz-mobicom', date: '2026-07-28', description: 'Repair parts & screens restock', category: 'inventory', type: 'expense', amount: 240000, paymentMethod: 'Bank transfer', reference: 'PO-MC-1098', status: 'cleared' },
  { id: 'tx-025', businessId: 'biz-mobicom', date: '2026-07-10', description: 'Summer promo — accessories bundles', category: 'marketing', type: 'expense', amount: 98000, paymentMethod: 'Card', reference: 'MKT-MC-0891', status: 'cleared' },

  // ——— CloudSpoon Kitchens ———
  { id: 'tx-026', businessId: 'biz-cloudspoon', date: '2026-09-13', description: 'Delivery platform payout — week 37', category: 'revenue', type: 'income', amount: 412000, paymentMethod: 'Bank transfer', reference: 'PAYOUT-CS-0937', status: 'cleared' },
  { id: 'tx-027', businessId: 'biz-cloudspoon', date: '2026-09-07', description: 'Commissary rent & kitchen equipment', category: 'rent', type: 'expense', amount: 380000, paymentMethod: 'Bank transfer', reference: 'RENT-CS-0312', status: 'cleared' },
  { id: 'tx-028', businessId: 'biz-cloudspoon', date: '2026-09-05', description: 'Raw ingredients — central commissary', category: 'inventory', type: 'expense', amount: 720000, paymentMethod: 'Bank transfer', reference: 'PO-CS-1187', status: 'pending' },
  { id: 'tx-029', businessId: 'biz-cloudspoon', date: '2026-08-24', description: 'Kitchen crew payroll — 41 staff', category: 'payroll', type: 'expense', amount: 1430000, paymentMethod: 'Payroll', reference: 'PAY-CS-1021', status: 'cleared' },
  { id: 'tx-030', businessId: 'biz-cloudspoon', date: '2026-08-16', description: '3rd city pre-launch deposits', category: 'operations', type: 'expense', amount: 250000, paymentMethod: 'Bank transfer', reference: 'EXP-CS-1015', status: 'flagged', notes: 'Holding deposit; recoverable if site falls through' },

  // ——— Stride Sportswear ———
  { id: 'tx-031', businessId: 'biz-stride-sportswear', date: '2026-09-15', description: 'Monthly retainer — Oct (agency fee)', category: 'revenue', type: 'income', amount: 185000, paymentMethod: 'Bank transfer', reference: 'INV-ST-1521', status: 'cleared', notes: 'Management retainer + performance ads pass-through' },
  { id: 'tx-032', businessId: 'biz-stride-sportswear', date: '2026-09-11', description: 'Storefront revenue — marketplace payout', category: 'revenue', type: 'income', amount: 690000, paymentMethod: 'Bank transfer', reference: 'INV-ST-1518', status: 'cleared' },
  { id: 'tx-033', businessId: 'biz-stride-sportswear', date: '2026-09-06', description: 'Meta ads spend — September', category: 'marketing', type: 'expense', amount: 210000, paymentMethod: 'Card', reference: 'MKT-ST-1203', status: 'cleared' },
  { id: 'tx-034', businessId: 'biz-stride-sportswear', date: '2026-08-28', description: 'Influencer campaign — 6 creators', category: 'marketing', type: 'expense', amount: 145000, paymentMethod: 'Bank transfer', reference: 'MKT-ST-1196', status: 'cleared', notes: 'CPE in target; extending 3 creators in Oct' },
  { id: 'tx-035', businessId: 'biz-stride-sportswear', date: '2026-08-19', description: 'Inventory restock — core line', category: 'inventory', type: 'expense', amount: 540000, paymentMethod: 'Bank transfer', reference: 'PO-ST-0867', status: 'cleared' },
  { id: 'tx-036', businessId: 'biz-stride-sportswear', date: '2026-07-31', description: 'Warehouse & ops fee', category: 'operations', type: 'expense', amount: 118000, paymentMethod: 'Bank transfer', reference: 'EXP-ST-0842', status: 'cleared' },

  // ——— Craft Coffee Roasters ———
  { id: 'tx-037', businessId: 'biz-craft-coffee', date: '2026-09-12', description: 'Consulting retainers — Sept (3 cafés)', category: 'revenue', type: 'income', amount: 150000, paymentMethod: 'Bank transfer', reference: 'INV-CR-0238', status: 'cleared' },
  { id: 'tx-038', businessId: 'biz-craft-coffee', date: '2026-09-04', description: 'Staff training programme — barista cert', category: 'revenue', type: 'income', amount: 42000, paymentMethod: 'Bank transfer', reference: 'INV-CR-0232', status: 'cleared' },
  { id: 'tx-039', businessId: 'biz-craft-coffee', date: '2026-08-27', description: 'Café POS systems rollout (2 shops)', category: 'operations', type: 'expense', amount: 96000, paymentMethod: 'Bank transfer', reference: 'EXP-CR-0459', status: 'cleared', notes: 'Paid by client, reimbursement to us' },
  { id: 'tx-040', businessId: 'biz-craft-coffee', date: '2026-08-13', description: 'Supply chain audit — third party', category: 'consulting', type: 'expense', amount: 55000, paymentMethod: 'Bank transfer', reference: 'EXP-CR-0452', status: 'cleared' },

  // ——— Nova Fitness Studios ———
  { id: 'tx-041', businessId: 'biz-nova-fitness', date: '2026-09-14', description: 'Project milestone — studio 2 launch plan', category: 'revenue', type: 'income', amount: 330000, paymentMethod: 'Bank transfer', reference: 'INV-NF-0711', status: 'pending', notes: 'Second milestone invoice; payment due in 7 days' },
  { id: 'tx-042', businessId: 'biz-nova-fitness', date: '2026-09-08', description: 'Member platform subscription — resold', category: 'software', type: 'expense', amount: 45000, paymentMethod: 'Card', reference: 'EXP-NF-0622', status: 'cleared' },
  { id: 'tx-043', businessId: 'biz-nova-fitness', date: '2026-08-31', description: 'Launch marketing kit & local ads', category: 'marketing', type: 'expense', amount: 88000, paymentMethod: 'Bank transfer', reference: 'MKT-NF-0605', status: 'cleared' },
  { id: 'tx-044', businessId: 'biz-nova-fitness', date: '2026-08-20', description: 'Consulting day-rates — August block', category: 'revenue', type: 'income', amount: 210000, paymentMethod: 'Bank transfer', reference: 'INV-NF-0698', status: 'cleared' },
  { id: 'tx-045', businessId: 'biz-nova-fitness', date: '2026-08-07', description: 'Studio 2 equipment consultation', category: 'consulting', type: 'expense', amount: 60000, paymentMethod: 'Bank transfer', reference: 'EXP-NF-0591', status: 'cleared' },

  // ——— All-purpose / operations ———
  { id: 'tx-046', businessId: 'biz-apex-autospa', date: '2026-09-01', description: 'Booking & CRM software (annual)', category: 'software', type: 'expense', amount: 120000, paymentMethod: 'Bank transfer', reference: 'SW-AA-0031', status: 'cleared' },
  { id: 'tx-047', businessId: 'biz-luxe-laundry', date: '2026-08-21', description: 'Fleet rider uniforms & PPE', category: 'operations', type: 'expense', amount: 26000, paymentMethod: 'Card', reference: 'EXP-LX-0828', status: 'cleared' },
  { id: 'tx-048', businessId: 'biz-stride-sportswear', date: '2026-09-03', description: 'Shopify + analytics stack', category: 'software', type: 'expense', amount: 34000, paymentMethod: 'Card', reference: 'SW-ST-0044', status: 'cleared' },
  { id: 'tx-049', businessId: 'biz-mobicom', date: '2026-09-11', description: 'In-store security & surveillance upgrade', category: 'equipment', type: 'expense', amount: 195000, paymentMethod: 'Bank transfer', reference: 'EQ-MC-0077', status: 'cleared' },
  { id: 'tx-050', businessId: 'biz-gearhead-motors', date: '2026-09-15', description: 'Tool resale — workshop wind-down', category: 'equipment', type: 'income', amount: 97000, paymentMethod: 'Cash', reference: 'INV-GM-0345', status: 'cleared', notes: 'Sold workbenches & lifts to competitor' },
]