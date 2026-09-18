import { config } from 'dotenv'
import { resolve } from 'path'
import { beforeAll, afterAll, afterEach } from 'vitest'

// Load .env before importing app modules
config({ path: resolve(__dirname, '../.env') })

// Override DATABASE_URL to use test database
const originalDbUrl = process.env.DATABASE_URL
if (originalDbUrl) {
  process.env.DATABASE_URL = originalDbUrl.replace(/\/[^/]+$/, '/zainpreneur_test')
}

// Dynamic import ensures prisma is created with the correct DATABASE_URL
const { prisma } = await import('../src/db/client')

const tableNames = [
  'ActivityEvent',
  'Task',
  'Transaction',
  'InvoicePayment',
  'Invoice',
  'LedgerLine',
  'LedgerEntry',
  'LedgerAccount',
  'Timesheet',
  'HrContract',
  'POItem',
  'PurchaseOrder',
  'Vendor',
  'AssetDeployment',
  'Asset',
  'TeamMember',
  'CapShare',
  'Owner',
  'Branch',
  'ProjectMilestone',
  'ProjectDetails',
  'ConsultingDetails',
  'EquityDetails',
  'Business',
  'OutboxEntry',
  'AppSettings',
  'UserProfile',
  'User',
]

beforeAll(async () => {
  // Verify database connection
  await prisma.$queryRaw`SELECT 1`
})

afterEach(async () => {
  // Delete all records in reverse dependency order
  for (const table of tableNames) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`)
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})
