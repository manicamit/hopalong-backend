import { Router } from "express";
import { GeoCodingController } from "../controllers/geocodingController";
import { RouteMatchController } from "../controllers/routematchController";

const router = Router();

router.post("/geocoding", GeoCodingController.getCoordinates);
router.post("/route/save", RouteMatchController.saveRoute);
router.post("/route/match", RouteMatchController.matchRoute);

export default router;
