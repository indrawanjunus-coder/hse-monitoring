import { schedule } from "node-cron";
import { db, incidentsTable, usersTable, groupsTable, groupMembersTable, plantsTable, categoriesTable } from "@workspace/db";
import { eq, and, inArray, ne } from "drizzle-orm";
import { sendEmail, incidentTargetReminderHtml } from "./email";
import { logger } from "./logger";

function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function sendIncidentTargetReminders() {
  const now = new Date();
  const today = getLocalDateString(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  logger.info({ today, tomorrow }, "Running incident target date reminders");

  const openStatuses = ["open", "in_progress"] as const;

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

        let emails: string[] = [];
        if (incident.assignedGroupId) {
          const members = await db
            .select({ email: usersTable.email })
            .from(groupMembersTable)
            .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
            .where(eq(groupMembersTable.groupId, incident.assignedGroupId));
          emails = members.map(m => m.email).filter(Boolean) as string[];
        }

        if (emails.length === 0) {
          logger.info({ incidentId: incident.id, type }, "No PIC emails found, skipping reminder");
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
          logger.warn({ incidentId: incident.id, type, error: result.error }, "Failed to send incident target reminder");
        }
      } catch (err) {
        logger.error({ err, incidentId: incident.id, type }, "Error sending incident target reminder");
      }
    }
  }
}

export function startReminderCron() {
  schedule("0 7 * * *", () => {
    sendIncidentTargetReminders().catch(err =>
      logger.error({ err }, "Incident reminder cron error")
    );
  });
  logger.info("Incident target date reminder cron started (runs daily at 07:00)");
}
