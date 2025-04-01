import crypto from "crypto";

export const generateOtp = () => {
    return crypto.randomInt(100000,999999).toString();
    
}

export const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
}