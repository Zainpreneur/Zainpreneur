import type { Branch, BranchStatus } from '../types'

interface BranchSpec {
  id: string
  name: string
  address: string
  city: string
  country?: string
  status?: BranchStatus
  openedYear: number
  monthlyRevenue: number
  monthlyExpenses: number
  employees: number
  isHeadquarters?: boolean
  manager?: string
  phone?: string
}

const SPECS: Record<string, BranchSpec[]> = {
  'biz-apex-autospa': [
    {
      id: 'br-aa-1',
      name: 'DHA Phase 5 Flagship',
      address: '12-C, Broadway Commercial, DHA Phase 5',
      city: 'Lahore',
      openedYear: 2021,
      monthlyRevenue: 52000,
      monthlyExpenses: 33000,
      employees: 8,
      isHeadquarters: true,
      manager: 'Hassan Mir',
      phone: '+92 300 111 2233',
    },
    {
      id: 'br-aa-2',
      name: 'Gulberg Detailing Studio',
      address: '88-B, Main Boulevard, Gulberg III',
      city: 'Lahore',
      openedYear: 2023,
      monthlyRevenue: 29500,
      monthlyExpenses: 17000,
      employees: 4,
      manager: 'Ayesha Rana',
    },
    {
      id: 'br-aa-3',
      name: 'Fleet Valeting Bay',
      address: 'Industrial Estate, Kot Lakhpat',
      city: 'Lahore',
      openedYear: 2024,
      monthlyRevenue: 15000,
      monthlyExpenses: 11200,
      employees: 2,
      manager: 'Imran Yousaf',
    },
  ],
  'biz-luxe-laundry': [
    {
      id: 'br-lx-1',
      name: 'Gulberg Processing Plant',
      address: '24, FCC Gulberg IV',
      city: 'Lahore',
      openedYear: 2022,
      monthlyRevenue: 34000,
      monthlyExpenses: 24500,
      employees: 6,
      isHeadquarters: true,
      manager: 'Sana Tariq',
      phone: '+92 321 444 5566',
    },
    {
      id: 'br-lx-2',
      name: 'DHA Collection Hub',
      address: 'Y-Block Commercial, DHA Phase 3',
      city: 'Lahore',
      openedYear: 2023,
      monthlyRevenue: 20800,
      monthlyExpenses: 15100,
      employees: 3,
      manager: 'Bilal Ahmed',
    },
  ],
  'biz-gearhead-motors': [
    {
      id: 'br-gm-1',
      name: 'Johar Town Workshop',
      address: 'Block G, Johar Town',
      city: 'Lahore',
      openedYear: 2019,
      monthlyRevenue: 21400,
      monthlyExpenses: 25900,
      employees: 4,
      isHeadquarters: true,
      manager: 'Usman Cheema',
      phone: '+92 333 777 8899',
    },
  ],
  'biz-mobicom': [
    {
      id: 'br-mc-1',
      name: 'Fortress Flagship',
      address: 'Shop 14, Fortress Stadium',
      city: 'Lahore',
      openedYear: 2018,
      monthlyRevenue: 62000,
      monthlyExpenses: 50000,
      employees: 14,
      isHeadquarters: true,
      manager: 'Bilal Khawaja',
      phone: '+92 345 222 7788',
    },
    {
      id: 'br-mc-2',
      name: 'DHA Phase 3 Outlet',
      address: 'Z-Block Market, DHA Phase 3',
      city: 'Lahore',
      openedYear: 2020,
      monthlyRevenue: 46000,
      monthlyExpenses: 39000,
      employees: 10,
      manager: 'Kamran Shah',
    },
    {
      id: 'br-mc-3',
      name: 'Johar Town Outlet',
      address: 'Emporium Mall, Johar Town',
      city: 'Lahore',
      openedYear: 2022,
      monthlyRevenue: 34000,
      monthlyExpenses: 29500,
      employees: 8,
      manager: 'Sadia Noor',
    },
  ],
  'biz-cloudspoon': [
    {
      id: 'br-cs-1',
      name: 'Lahore Commissary',
      address: 'Central Park, Model Town',
      city: 'Lahore',
      openedYear: 2023,
      monthlyRevenue: 43000,
      monthlyExpenses: 45000,
      employees: 20,
      isHeadquarters: true,
      manager: 'Rafi Gondal',
      phone: '+92 311 909 8001',
    },
    {
      id: 'br-cs-2',
      name: 'Karachi Commissary',
      address: 'Khayaban-e-Ittehad, DHA Phase 6',
      city: 'Karachi',
      openedYear: 2024,
      monthlyRevenue: 27700,
      monthlyExpenses: 29000,
      employees: 13,
      manager: 'Shoaib Malik',
    },
    {
      id: 'br-cs-3',
      name: 'Islamabad Kitchen',
      address: 'F-8 Markaz',
      city: 'Islamabad',
      status: 'opening',
      openedYear: 2025,
      monthlyRevenue: 18000,
      monthlyExpenses: 18400,
      employees: 8,
      manager: 'Nida Iqbal',
    },
  ],
  'biz-stride-sportswear': [
    {
      id: 'br-st-1',
      name: 'Karachi HQ & Studio',
      address: 'Office 4, Clifton Block 5',
      city: 'Karachi',
      openedYear: 2020,
      monthlyRevenue: 45000,
      monthlyExpenses: 36000,
      employees: 11,
      isHeadquarters: true,
      manager: 'Omar Sheikh',
      phone: '+92 331 555 9900',
    },
    {
      id: 'br-st-2',
      name: 'Lahore Fulfilment Studio',
      address: 'DHA Phase 6, Sector C',
      city: 'Lahore',
      openedYear: 2023,
      monthlyRevenue: 27400,
      monthlyExpenses: 22300,
      employees: 7,
      manager: 'Noor Fatima',
    },
  ],
  'biz-craft-coffee': [
    {
      id: 'br-cr-1',
      name: 'Bahria Roastery & Café',
      address: 'Civic Center, Bahria Town',
      city: 'Rawalpindi',
      openedYear: 2021,
      monthlyRevenue: 22000,
      monthlyExpenses: 18500,
      employees: 5,
      isHeadquarters: true,
      manager: 'Daniyal Raza',
      phone: '+92 301 222 4141',
    },
    {
      id: 'br-cr-2',
      name: 'Saddar Café',
      address: 'Bank Road, Saddar',
      city: 'Rawalpindi',
      openedYear: 2022,
      monthlyRevenue: 14800,
      monthlyExpenses: 12400,
      employees: 4,
      manager: 'Kiran Aslam',
    },
    {
      id: 'br-cr-3',
      name: 'F-7 Kiosk',
      address: 'F-7 Markaz',
      city: 'Islamabad',
      status: 'paused',
      openedYear: 2024,
      monthlyRevenue: 10000,
      monthlyExpenses: 8300,
      employees: 2,
      manager: 'Talha Bin Rashid',
    },
  ],
  'biz-nova-fitness': [
    {
      id: 'br-nf-1',
      name: 'Lakeside Studio',
      address: 'Lake View Avenue, Sector F',
      city: 'Islamabad',
      openedYear: 2022,
      monthlyRevenue: 40000,
      monthlyExpenses: 36000,
      employees: 15,
      isHeadquarters: true,
      manager: 'Hira Baig',
      phone: '+92 312 666 7333',
    },
    {
      id: 'br-nf-2',
      name: 'F-10 Studio',
      address: 'F-10 Markaz',
      city: 'Islamabad',
      openedYear: 2024,
      monthlyRevenue: 27100,
      monthlyExpenses: 25200,
      employees: 11,
      manager: 'Farah Nadeem',
    },
  ],
}

function makeBranch(businessId: string, spec: BranchSpec): Branch {
  const country = spec.country ?? 'Pakistan'
  return {
    id: spec.id,
    businessId,
    name: spec.name,
    location: `${spec.address}, ${spec.city}`,
    address: spec.address,
    city: spec.city,
    country,
    phone: spec.phone,
    manager: spec.manager,
    status: spec.status ?? 'active',
    openedYear: spec.openedYear,
    monthlyRevenue: spec.monthlyRevenue,
    monthlyExpenses: spec.monthlyExpenses,
    employees: spec.employees,
    isHeadquarters: spec.isHeadquarters ?? false,
    createdAt: `${spec.openedYear}-01-01T09:00:00Z`,
  }
}

export const branchesByBusiness: Record<string, Branch[]> = Object.fromEntries(
  Object.entries(SPECS).map(([businessId, specs]) => [businessId, specs.map((spec) => makeBranch(businessId, spec))]),
)

export const allBranches: Branch[] = Object.values(branchesByBusiness).flat()
