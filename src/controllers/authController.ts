import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { generateOtp, generateToken } from "../utils/generateHash";
import bcrypt from "bcrypt";
import handleError from "../utils/handleErrors";
import sendOtp from "../utils/handleOtp";

const client = new PrismaClient();

const otpMap = new Map();

export const signUp = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const ifExist = await client.user.findFirst({
      where: {
        email: email,
      },
    });

    if (!ifExist) {
      const hashedPassword: string = await bcrypt.hash(password, 10);

      const newUser = await client.user.create({
        data: {
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: hashedPassword,
        },
        select: {
          id: true,
        },
      });

      const otp = generateOtp();
      otpMap.set(email, { otp: otp, expiresAt: Date.now() + 5 * 60 * 1000 });
      await sendOtp({ otp, email, res });

      res.status(201).json({
        status: "success",
        payload: {
          message: "Verification email sent.",
        },
      });
    } else {
      res.status(409).json({
        status: "error",
        payload: {
          message: "email already in use",
        },
      });
    }

    return;
  } catch (e) {
    handleError(e, res);
    return;
  }
};

export const verify = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  try {
    const body = otpMap.get(email) || {};

    if (body.length === 0) {
      res.status(400).json({
        status: "error",
        payload: {
          message: "re-sign up.",
        },
      });
      return;
    }
    if (code === body.otp) {
      if (Date.now() <= body.expiresAt) {
        try {
          await client.user.update({
            where: {
              email: email,
            },
            data: {
              verified: true,
            },
          });

          res.status(200).json({
            status: "success",
            payload: {
              message: "Email verified. You can now log in.",
            },
          });
        } catch (e) {
          handleError(e, res);
        }

        return;
      } else {
        res.status(400).json({
          status: "error",
          payload: {
            message: "Otp expired, Retry.",
          },
        });
      }
    } else {
      res.status(400).json({
        status: "error",
        payload: {
          message: "Wrong otp.",
        },
      });
    }
  } catch (e: any) {
    console.log(e.message);
    handleError(e, res);
    return;
  }
};

export const logIn = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const checkUser = await client.user.findFirst({
      where: {
        email: email,
      },
      select: {
        password: true,
        verified: true,
      },
    });

    if (checkUser) {
      const verifyPassword = await bcrypt.compare(password, checkUser.password);

      if (verifyPassword) {
        if (checkUser.verified) {
          const token = generateToken();
          try {
            await client.user.update({
              where: {
                email: email,
              },
              data: {
                session_token: token,
              },
            });
            res.status(200).json({
              status: "success",
              payload: {
                message: "Signed in successfully",
                token,
              },
            });
          } catch (e) {
            handleError(e, res);
            return;
          }
        } else {
          res.status(401).json({
            status: "error",
            payload: {
              message: "Unautorised access/incorrect password",
            },
          });
        }
      } else {
        res.status(401).json({
          status: "error",
          payload: {
            message: "Email not verified.",
          },
        });
      }
    } else {
      res.status(404).json({
        staus: "error",
        payload: {
          message: "Invalid email",
        },
      });
    }

    return;
  } catch (e) {
    handleError(e, res);
    return;
  }
};
