import { Router } from "express";
import { GeoCodingController } from "../controllers/geocodingController";
import { RouteController } from "../controllers/routeController";
import AutocompleteController from "../controllers/autocompleteController";

const router = Router();

router.post("/geocoding", GeoCodingController.getCoordinates);
router.post("/autocomplete", AutocompleteController.getAddressSuggestions);
router.post("/route/findMatch", RouteController.findRouteMatch);
router.post("/route/merge", RouteController.mergeRoute);
router.post("/route/create", RouteController.createRoute);
/* 
router.get("/route/allrides", allRides);
router.post("/route/particularride", particularRide);
 */

export default router;
