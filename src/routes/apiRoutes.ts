import { Router } from "express";
import { GeoCodingController } from "../controllers/geocodingController";
import { RouteController } from "../controllers/routeController";
import AutocompleteController from "../controllers/autocompleteController";
import RideInfoController from "../controllers/rideInfoController";

const router = Router();

router.post("/geocoding", GeoCodingController.getCoordinates);
router.post("/autocomplete", AutocompleteController.getAddressSuggestions);
router.post("/route/findMatch", RouteController.findRouteMatch);
router.post("/route/merge", RouteController.createRouteinRide);
router.post("/route/create", RouteController.createRide);

// Important: Define the specific "previous" route before the parameterized route
router.get("/rides/previous", RideInfoController.getPreviousRides);
// Then the parameterized route
router.get("/rides/:rideId", RideInfoController.getRideDetails);

export default router;
