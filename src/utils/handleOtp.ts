import nodemailer from "nodemailer";
import handleError from "./handleErrors";
import { Response } from "express";

interface sendOtpBody { 
    otp : string,
    email: string,
    res : Response
}

interface mailOptionsBody { 
    from : string,
    to : string,
    subject : string,
    text : string
}

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


const sendOtp  = async ({otp, email, res}: sendOtpBody) => {
    const mailoptions : mailOptionsBody = {
        from : process.env.EMAIL_USER!,
        to : email,
        subject : "Your hopAlong opt is here!!",
        text : `Your OneTimePassword : ${otp}.\nNote: It is valid only for the next 5 minutes.\nDo not share you OPT to srangers.`
    }

    try{
        const response = await transporter.sendMail(mailoptions);
        console.log(response);
        return;
    }catch(e){
        handleError(e,res);
        return;
    }
}

export default sendOtp;
