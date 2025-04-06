import { Router } from "express";
import {
  signUp,
  logIn,
  verify,
  updateProfilePic,
  updatePrivacyLevel,
} from "../controllers/authController";

const router = Router();

router.post("/signup", signUp);
router.post("/login", logIn);
router.post("/verify", verify);
router.post("/updateProfilePic", updateProfilePic);
router.post("/updatePrivacyLevel", updatePrivacyLevel);

export default router;
