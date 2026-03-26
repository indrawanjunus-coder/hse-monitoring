import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
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

export default router;
