import nodemailer from "nodemailer";
import handleError from "./handleErrors";
import { Response } from "express";

interface sendOtpBody {
  otp: string;
  email: string;
  res: Response;
}

interface mailOptionsBody {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string; // Added optional html property
}

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtp = async ({ otp, email, res }: sendOtpBody) => {
  const mailoptions: mailOptionsBody = {
    from: `"HopAlong Support" <${process.env.EMAIL_USER!}>`,
    to: email,
    subject: "Your HopAlong OTP Code",
    text: `Dear User,

Your One-Time Password (OTP) is: ${otp}

Please note:
- This OTP is valid for the next 5 minutes.
- Do not share this OTP with anyone for security reasons.

If you did not request this OTP, please ignore this email.

Best regards,
The HopAlong Team`,
    html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4CAF50;">Your HopAlong OTP Code</h2>
            <p>Dear User,</p>
            <p>Your One-Time Password (OTP) is: <strong style="font-size: 1.2em;">${otp}</strong></p>
            <p><em>Please note:</em></p>
            <ul>
                <li>This OTP is valid for the next <strong>5 minutes</strong>.</li>
                <li>Do not share this OTP with anyone for security reasons.</li>
            </ul>
            <p>If you did not request this OTP, please ignore this email.</p>
            <p>Best regards,</p>
            <p><strong>The HopAlong Team</strong></p>
        </div>
    `,
  };

  try {
    const response = await transporter.sendMail(mailoptions);
    console.log(response);
    return;
  } catch (e) {
    handleError(e, res);
    return;
  }
};

export default sendOtp;
