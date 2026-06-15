import { Router } from "express";

import { signup, login } from "../handlers/auth.handlers";

const router = Router();

router.post("/signup", signup);

router.post("/login", login);

export default router;
