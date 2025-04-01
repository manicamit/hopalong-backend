import { Router } from 'express';
import {signUp, logIn, verify} from '../controllers/authController' 

const router = Router();

router.post('/signup', signUp);
router.post('/login', logIn);
router.post('/verify',verify);
 

export default router;