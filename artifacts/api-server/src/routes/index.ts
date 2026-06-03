import { Router, type IRouter } from "express";
import { companySubscriptionMiddleware } from "../lib/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import groupsRouter from "./groups";
import plantsRouter from "./plants";
import actionsRouter from "./actions";
import templatesRouter from "./templates";
import questionsRouter from "./questions";
import schedulesRouter from "./schedules";
import inspectionsRouter from "./inspections";
import incidentsRouter from "./incidents";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import smtpRouter from "./smtp";
import indicatorsRouter from "./indicators";
import preventiveActionsRouter from "./preventive-actions";
import incidentTypesRouter from "./incident-types";
import logsRouter from "./logs";
import gdriveSettingsRouter from "./gdrive-settings";
import attachmentsRouter from "./attachments";
import incidentCommentsRouter from "./incident-comments";
import incidentEscalationsRouter from "./incident-escalations";
import sysadminRouter from "./sysadmin";
import companyPaymentsRouter from "./company-payments";
import testimonialsRouter from "./testimonials";
import plansRouter from "./plans";
import backupRouter from "./backup";
import workPermitTypesRouter from "./work-permit-types";
import workPermitsRouter from "./work-permits";
import mapsRouter from "./maps";
import laggingIndicatorsRouter from "./lagging-indicators";

const router: IRouter = Router();

// ── Public / auth routes — NO subscription check ───────────────────────────
router.use(healthRouter);
router.use("/auth", authRouter);           // login, logout, register, /me
router.use("/sysadmin", sysadminRouter);   // sysadminMiddleware handles auth
router.use("/payments", companyPaymentsRouter); // allow expired companies to submit proof
router.use("/plans", plansRouter);         // public pricing info
router.use("/testimonials", testimonialsRouter); // public testimonials

// ── Paywall gate — all routes below require active subscription ─────────────
router.use(companySubscriptionMiddleware);

// ── Tenant-isolated authenticated routes ───────────────────────────────────
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/groups", groupsRouter);
router.use("/plants", plantsRouter);
router.use("/actions", actionsRouter);
router.use("/templates", templatesRouter);
router.use("/questions", questionsRouter);
router.use("/schedules", schedulesRouter);
router.use("/inspections", inspectionsRouter);
router.use("/incidents", incidentsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);
router.use("/settings/smtp", smtpRouter);
router.use("/indicators", indicatorsRouter);
router.use("/preventive-actions", preventiveActionsRouter);
router.use("/incident-types", incidentTypesRouter);
router.use("/logs", logsRouter);
router.use("/settings/gdrive", gdriveSettingsRouter);
router.use("/attachments", attachmentsRouter);
router.use("/incidents/:incidentId/comments", incidentCommentsRouter);
router.use("/incidents/:incidentId/escalations", incidentEscalationsRouter);
router.use("/backup", backupRouter);
router.use("/work-permit-types", workPermitTypesRouter);
router.use("/work-permits", workPermitsRouter);
router.use("/maps", mapsRouter);
router.use("/lagging-indicators", laggingIndicatorsRouter);

export default router;
