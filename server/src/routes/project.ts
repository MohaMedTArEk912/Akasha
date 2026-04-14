import { Router } from "express";
import * as ctrl from "../controllers/projectRoutesController.js";

const router = Router();

router.get("/", ctrl.listProjects);
router.get("/template", ctrl.getProjectImportTemplate);
router.get("/sample", ctrl.getProjectImportTemplate);
router.get("/sample-json", ctrl.getProjectImportTemplate);
router.post("/import", ctrl.importProject);
router.get("/:id/export", ctrl.exportProject);
router.get("/:id", ctrl.getProject);
router.post("/", ctrl.createProject);
router.put("/:id", ctrl.updateProject);
router.put("/:id/idea", ctrl.updateProjectIdea);
router.post("/:id/generate-idea-details", ctrl.generateStructuredIdea);
router.delete("/:id", ctrl.deleteProject);

export default router;
