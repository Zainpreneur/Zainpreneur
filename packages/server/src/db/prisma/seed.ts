import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'
const { hash } = bcryptjs

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default admin user
  const passwordHash = await hash('admin123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'admin@zainpreneur.com' },
    update: {},
    create: {
      email: 'admin@zainpreneur.com',
      passwordHash,
      name: 'Zain Admin',
      role: 'admin',
    },
  })

  // Create profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      bio: 'Founder & CEO of Zainpreneur',
      timezone: 'Asia/Karachi',
      businessSince: '2020',
      avatarColor: '#6366f1',
      initials: 'ZA',
    },
  })

  // Create settings
  await prisma.appSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      theme: 'system',
      currency: 'PKR',
    },
  })

  // Create chart of accounts
  const accounts = [
    { code: '1000', name: 'Cash', type: 'asset' },
    { code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { code: '1500', name: 'Equipment', type: 'asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability' },
    { code: '2100', name: 'Payroll Liability', type: 'liability' },
    { code: '2200', name: 'Shareholder Payable', type: 'liability' },
    { code: '3000', name: 'Owner Equity', type: 'equity' },
    { code: '4000', name: 'Revenue', type: 'revenue' },
    { code: '5000', name: 'Operating Expenses', type: 'expense' },
    { code: '5100', name: 'Salary Expense', type: 'expense' },
    { code: '5200', name: 'Contractor Expense', type: 'expense' },
  ]

  for (const account of accounts) {
    await prisma.ledgerAccount.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    })
  }

  console.log('Seed complete!')
  console.log(`  - User: ${user.email}`)
  console.log(`  - Accounts: ${accounts.length} ledger accounts`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
