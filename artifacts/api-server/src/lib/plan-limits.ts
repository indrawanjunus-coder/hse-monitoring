import { db, companiesTable, plansTable, usersTable, templatesTable } from "@workspace/db";
import { eq, and, ne, inArray, count } from "drizzle-orm";

export interface PlanLimits {
  maxUsers: number | null;
  maxTemplates: number | null;
}

export async function getPlanLimits(companyId: number): Promise<PlanLimits | null> {
  const [company] = await db.select({ plan: companiesTable.plan }).from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company) return null;
  const [plan] = await db.select({ maxUsers: plansTable.maxUsers, maxTemplates: plansTable.maxTemplates })
    .from(plansTable).where(eq(plansTable.slug, company.plan));
  return {
    maxUsers: plan?.maxUsers ?? null,
    maxTemplates: plan?.maxTemplates ?? null,
  };
}

function shuffleIds(ids: { id: number }[]): number[] {
  const arr = ids.map(r => r.id);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export async function enforcePlanLimits(companyId: number): Promise<{ deactivatedUsers: number; deactivatedTemplates: number }> {
  const limits = await getPlanLimits(companyId);
  if (!limits) return { deactivatedUsers: 0, deactivatedTemplates: 0 };

  let deactivatedUsers = 0;
  let deactivatedTemplates = 0;

  // Enforce user limit
  if (limits.maxUsers !== null) {
    // Get active users — admins last priority for deactivation (protect company admins as much as possible)
    const activeNonAdmins = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.companyId, companyId), eq(usersTable.isActive, true), ne(usersTable.role, "admin"), ne(usersTable.role, "sysadmin")));
    const activeAdmins = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.companyId, companyId), eq(usersTable.isActive, true), eq(usersTable.role, "admin")));

    const totalActive = activeNonAdmins.length + activeAdmins.length;
    if (totalActive > limits.maxUsers) {
      const overBy = totalActive - limits.maxUsers;
      // First deactivate non-admins randomly
      const nonAdminIds = shuffleIds(activeNonAdmins);
      const toDeactivateNonAdmin = nonAdminIds.slice(0, Math.min(overBy, nonAdminIds.length));
      if (toDeactivateNonAdmin.length > 0) {
        await db.update(usersTable).set({ isActive: false }).where(inArray(usersTable.id, toDeactivateNonAdmin));
        deactivatedUsers += toDeactivateNonAdmin.length;
      }
      // If still over, deactivate admins (but keep at least 1 admin active)
      const remainingOver = overBy - toDeactivateNonAdmin.length;
      if (remainingOver > 0) {
        const adminIds = shuffleIds(activeAdmins);
        const toDeactivateAdmin = adminIds.slice(0, Math.max(0, Math.min(remainingOver, adminIds.length - 1)));
        if (toDeactivateAdmin.length > 0) {
          await db.update(usersTable).set({ isActive: false }).where(inArray(usersTable.id, toDeactivateAdmin));
          deactivatedUsers += toDeactivateAdmin.length;
        }
      }
    }
  }

  // Enforce template limit
  if (limits.maxTemplates !== null) {
    const activeTemplates = await db.select({ id: templatesTable.id }).from(templatesTable)
      .where(and(eq(templatesTable.companyId, companyId), eq(templatesTable.isActive, true)));
    if (activeTemplates.length > limits.maxTemplates) {
      const toDeactivateIds = shuffleIds(activeTemplates).slice(limits.maxTemplates);
      if (toDeactivateIds.length > 0) {
        await db.update(templatesTable).set({ isActive: false }).where(inArray(templatesTable.id, toDeactivateIds));
        deactivatedTemplates += toDeactivateIds.length;
      }
    }
  }

  return { deactivatedUsers, deactivatedTemplates };
}

export async function checkUserLimit(companyId: number): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const limits = await getPlanLimits(companyId);
  if (!limits || limits.maxUsers === null) return { allowed: true, current: 0, max: null };
  const [row] = await db.select({ cnt: count() }).from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), eq(usersTable.isActive, true), ne(usersTable.role, "sysadmin")));
  const current = Number(row?.cnt ?? 0);
  return { allowed: current < limits.maxUsers, current, max: limits.maxUsers };
}

export async function checkTemplateLimit(companyId: number): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const limits = await getPlanLimits(companyId);
  if (!limits || limits.maxTemplates === null) return { allowed: true, current: 0, max: null };
  const [row] = await db.select({ cnt: count() }).from(templatesTable)
    .where(and(eq(templatesTable.companyId, companyId), eq(templatesTable.isActive, true)));
  const current = Number(row?.cnt ?? 0);
  return { allowed: current < limits.maxTemplates, current, max: limits.maxTemplates };
}
