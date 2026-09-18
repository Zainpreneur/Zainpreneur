import { Hono } from 'hono'
import { prisma } from '../../db/client'
import { NotFoundError } from '../../lib/errors'
import { teamMemberCreateSchema, teamMemberUpdateSchema } from '@zainpreneur/shared'

export const teamRoutes = new Hono()

teamRoutes.get('/', async (c) => {
  const members = await prisma.teamMember.findMany({
    orderBy: { name: 'asc' },
  })
  return c.json({ data: members })
})

teamRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = teamMemberCreateSchema.parse(body)

  const member = await prisma.teamMember.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      role: parsed.role ?? '',
      phone: parsed.phone,
      color: parsed.color ?? '#6366f1',
      initials: parsed.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      department: parsed.department ?? '',
      engagementType: parsed.engagementType ?? 'internal',
      employmentType: parsed.employmentType,
      activeBusinessId: parsed.activeBusinessId,
      associatedBusinessId: parsed.associatedBusinessId,
      branchId: parsed.branchId,
      location: parsed.location,
      startedAt: parsed.startedAt,
      monthlyCost: parsed.monthlyCost,
      hourlyRate: parsed.hourlyRate,
      contractTerms: parsed.contractTerms,
      projectScope: parsed.projectScope,
      contractEndDate: parsed.contractEndDate,
      companyName: parsed.companyName,
      contactPerson: parsed.contactPerson,
      projectAllocation: parsed.projectAllocation !== undefined ? Number(parsed.projectAllocation) : null,
      retainerMonthly: parsed.retainerMonthly,
      skills: parsed.skills ?? [],
    },
  })

  return c.json({ data: member }, 201)
})

teamRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const parsed = teamMemberUpdateSchema.parse(body)

  const existing = await prisma.teamMember.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Team member', id)

  const data: Record<string, any> = {}
  if (parsed.name !== undefined) data.name = parsed.name
  if (parsed.email !== undefined) data.email = parsed.email
  if (parsed.role !== undefined) data.role = parsed.role
  if (parsed.phone !== undefined) data.phone = parsed.phone
  if (parsed.color !== undefined) data.color = parsed.color
  if (parsed.department !== undefined) data.department = parsed.department
  if (parsed.engagementType !== undefined) data.engagementType = parsed.engagementType
  if (parsed.employmentType !== undefined) data.employmentType = parsed.employmentType
  if (parsed.activeBusinessId !== undefined) data.activeBusinessId = parsed.activeBusinessId
  if (parsed.associatedBusinessId !== undefined) data.associatedBusinessId = parsed.associatedBusinessId
  if (parsed.branchId !== undefined) data.branchId = parsed.branchId
  if (parsed.location !== undefined) data.location = parsed.location
  if (parsed.startedAt !== undefined) data.startedAt = parsed.startedAt
  if (parsed.monthlyCost !== undefined) data.monthlyCost = parsed.monthlyCost
  if (parsed.hourlyRate !== undefined) data.hourlyRate = parsed.hourlyRate
  if (parsed.contractTerms !== undefined) data.contractTerms = parsed.contractTerms
  if (parsed.projectScope !== undefined) data.projectScope = parsed.projectScope
  if (parsed.contractEndDate !== undefined) data.contractEndDate = parsed.contractEndDate
  if (parsed.companyName !== undefined) data.companyName = parsed.companyName
  if (parsed.contactPerson !== undefined) data.contactPerson = parsed.contactPerson
  if (parsed.projectAllocation !== undefined) data.projectAllocation = parsed.projectAllocation
  if (parsed.retainerMonthly !== undefined) data.retainerMonthly = parsed.retainerMonthly
  if (parsed.skills !== undefined) data.skills = parsed.skills

  if (parsed.name && parsed.name !== existing.name) {
    data.initials = parsed.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const updated = await prisma.teamMember.update({
    where: { id },
    data,
  })

  return c.json({ data: updated })
})

teamRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await prisma.teamMember.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Team member', id)

  await prisma.teamMember.delete({ where: { id } })
  return c.json({ success: true })
})
