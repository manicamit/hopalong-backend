import { Router } from "express";
import { GeoCodingController } from "../controllers/geocodingController";
import { RouteMatchController } from "../controllers/routematchController";
import { allRides, particularRide} from "../controllers/rideInfoController";


const router = Router();

console.log(typeof particularRide); // Should print "function" 

router.post("/geocoding", GeoCodingController.getCoordinates);
router.post("/route/match", RouteMatchController.matchRoute);
router.get("/route/allrides",allRides);
router.post("/route/particularride",particularRide);
router.post("/route/save", RouteMatchController.saveRoute);

export default router;
