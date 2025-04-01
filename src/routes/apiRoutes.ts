import { Router } from 'express';
import {GeoCodingController} from '../controllers/geocodingController' 

const router = Router();

router.post('/geocoding', GeoCodingController.getCoordinates);


 

export default router;