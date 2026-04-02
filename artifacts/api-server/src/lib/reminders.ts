import { schedule } from "node-cron";
import { db, incidentsTable, usersTable, groupsTable, groupMembersTable, plantsTable, categoriesTable } from "@workspace/db";
import { eq, and, ne, lt } from "drizzle-orm";
import { sendEmail, incidentTargetReminderHtml, incidentEscalationHtml } from "./email";
import { logger } from "./logger";

function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function getPicEmails(assignedGroupId: number): Promise<string[]> {
  const members = await db
    .select({ email: usersTable.email })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, assignedGroupId));
  return members.map(m => m.email).filter(Boolean) as string[];
}

async function sendIncidentTargetReminders() {
  const now = new Date();
  const today = getLocalDateString(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  logger.info({ today, tomorrow }, "Running incident target date reminders");

  for (const [targetDate, type] of [[today, "H"], [tomorrow, "H-1"]] as [string, "H" | "H-1"][]) {
    const incidents = await db
      .select()
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.targetDate, targetDate),
          ne(incidentsTable.status, "closed")
        )
      );

    if (incidents.length === 0) continue;

    for (const incident of incidents) {
      try {
        const [reporter] = incident.reporterId
          ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, incident.reporterId))
          : [undefined];
        const [plant] = incident.plantId
          ? await db.select({ name: plantsTable.name }).from(plantsTable).where(eq(plantsTable.id, incident.plantId))
          : [undefined];
        const [category] = incident.categoryId
          ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, incident.categoryId))
          : [undefined];
        const [group] = incident.assignedGroupId
          ? await db.select({ name: groupsTable.name }).from(groupsTable).where(eq(groupsTable.id, incident.assignedGroupId))
          : [undefined];

        const emails = incident.assignedGroupId ? await getPicEmails(incident.assignedGroupId) : [];
        if (emails.length === 0) {
          logger.info({ incidentId: incident.id, type }, "No PIC emails, skipping target reminder");
          continue;
        }

        const html = incidentTargetReminderHtml({
          id: incident.id,
          detail: incident.detail,
          categoryName: category?.name,
          plantName: plant?.name,
          targetDate: incident.targetDate!,
          reporterName: reporter?.name,
          assignedGroupName: group?.name,
          type,
        });

        const subjectPrefix = type === "H" ? "[HSE] ⏰ Batas Hari Ini" : "[HSE] 📅 Pengingat H-1";
        const subject = `${subjectPrefix} - Incident #${incident.id} ${category?.name ? `(${category.name})` : ""}`;

        const result = await sendEmail(emails, subject, html);
        if (result.success) {
          logger.info({ incidentId: incident.id, type, emails }, "Incident target reminder sent");
        } else {
          logger.warn({ incidentId: incident.id, type, error: result.error }, "Failed to send target reminder");
        }
      } catch (err) {
        logger.error({ err, incidentId: incident.id, type }, "Error sending target reminder");
      }
    }
  }
}

async function sendEscalationReminders() {
  const now = new Date();
  logger.info("Running incident escalation check");

  const openIncidents = await db
    .select()
    .from(incidentsTable)
    .where(
      and(
        ne(incidentsTable.status, "closed"),
        lt(incidentsTable.escalationLevel, 3)
      )
    );

  for (const incident of openIncidents) {
    const hoursOpen = (now.getTime() - incident.createdAt.getTime()) / (1000 * 60 * 60);
    const currentLevel = incident.escalationLevel;

    const neededLevel = hoursOpen >= 72 ? 3 : hoursOpen >= 48 ? 2 : hoursOpen >= 24 ? 1 : 0;
    if (neededLevel <= currentLevel) continue;

    try {
      const [reporter] = incident.reporterId
        ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, incident.reporterId))
        : [undefined];
      const [plant] = incident.plantId
        ? await db.select({ name: plantsTable.name }).from(plantsTable).where(eq(plantsTable.id, incident.plantId))
        : [undefined];
      const [category] = incident.categoryId
        ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, incident.categoryId))
        : [undefined];
      const [group] = incident.assignedGroupId
        ? await db.select({ name: groupsTable.name }).from(groupsTable).where(eq(groupsTable.id, incident.assignedGroupId))
        : [undefined];

      const emails = incident.assignedGroupId ? await getPicEmails(incident.assignedGroupId) : [];
      if (emails.length === 0) {
        logger.info({ incidentId: incident.id, neededLevel }, "No PIC emails, skipping escalation");
        await db.update(incidentsTable).set({ escalationLevel: neededLevel }).where(eq(incidentsTable.id, incident.id));
        continue;
      }

      const levelLabel: Record<number, string> = { 1: "24 Jam", 2: "48 Jam", 3: "72 Jam" };
      const urgency: Record<number, string> = { 1: "⚠️", 2: "🔴", 3: "🚨 KRITIS" };
      const html = incidentEscalationHtml({
        id: incident.id,
        detail: incident.detail,
        categoryName: category?.name,
        plantName: plant?.name,
        reporterName: reporter?.name,
        assignedGroupName: group?.name,
        createdAt: incident.createdAt.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        hoursOpen,
      });

      const subject = `[HSE] ${urgency[neededLevel]} Eskalasi ${levelLabel[neededLevel]} - Incident #${incident.id} Belum Ditindak`;
      const result = await sendEmail(emails, subject, html);

      await db.update(incidentsTable).set({ escalationLevel: neededLevel }).where(eq(incidentsTable.id, incident.id));

      if (result.success) {
        logger.info({ incidentId: incident.id, neededLevel, hoursOpen: Math.floor(hoursOpen), emails }, "Escalation email sent");
      } else {
        logger.warn({ incidentId: incident.id, neededLevel, error: result.error }, "Failed to send escalation email");
      }
    } catch (err) {
      logger.error({ err, incidentId: incident.id }, "Error sending escalation email");
    }
  }
}

export function startReminderCron() {
  schedule("0 7 * * *", () => {
    sendIncidentTargetReminders().catch(err =>
      logger.error({ err }, "Incident target reminder cron error")
    );
  });

  schedule("0 * * * *", () => {
    sendEscalationReminders().catch(err =>
      logger.error({ err }, "Incident escalation cron error")
    );
  });

  logger.info("Reminder crons started: target reminders (daily 07:00), escalation check (every hour)");
}
