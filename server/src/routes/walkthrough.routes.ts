import { Router } from "express";

import {
  createWalkthrough,
  deleteWalkthrough,
  getWalkthrough,
  listWalkthroughs,
  updateWalkthrough,
} from "../handlers/walkthrough.handlers";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.post("/", createWalkthrough);
router.get("/", listWalkthroughs);
router.get("/:id", getWalkthrough);
router.put("/:id", updateWalkthrough);
router.delete("/:id", deleteWalkthrough);

export default router;
