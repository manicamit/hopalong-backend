import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { generateOtp, generateToken } from "../utils/generateHash";
import bcrypt from "bcrypt";
import handleError from "../utils/handleErrors";
import sendOtp from "../utils/handleOtp";

const client = new PrismaClient();

export const signUp = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  // Add validation for required fields
  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({
      status: "error",
      payload: {
        message:
          "All fields are required: firstName, lastName, email, password",
      },
    });
    return;
  }

  //email ending in @iiitkottayam.ac.in
  if (!email.endsWith("@iiitkottayam.ac.in")) {
    res.status(400).json({
      status: "error",
      payload: {
        message: "Email must end with @iiitkottayam.ac.in",
      },
    });
    return;
  }
  // password length should be greater than 6
  if (password.length < 6) {
    res.status(400).json({
      status: "error",
      payload: {
        message: "Password must be at least 6 characters long",
      },
    });
    return;
  }

  try {
    const ifExist = await client.user.findFirst({
      where: {
        email: email,
      },
    });

    if (!ifExist) {
      const hashedPassword: string = await bcrypt.hash(password, 10);
      const otp = generateOtp();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      const newUser = await client.user.create({
        data: {
          profilePic:
            "https://tqcavgfvflryuqjaemnf.supabase.co/storage/v1/object/public/hopalonguserpics/blue-circle-with-white-user_78370-4707.avif",
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: hashedPassword,
          otp: otp,
          otpExpires: otpExpires,
          privateFName: `User${firstName.charAt(0)}`, // Default private name
          privateLName: `${lastName.charAt(0)}`, // Default private name
        },
        select: {
          id: true,
        },
      });

      await sendOtp({ otp, email, res });

      res.status(201).json({
        status: "success",
        payload: {
          message: "Verification email sent.",
        },
      });
    } else {
      // if not verified send otp again
      if (!ifExist.verified) {
        const otp = generateOtp();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        await client.user.update({
          where: {
            email: email,
          },
          data: {
            otp: otp,
            otpExpires: otpExpires,
          },
        });

        await sendOtp({ otp, email, res });
        res.status(200).json({
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
    const user = await client.user.findFirst({
      where: {
        email: email,
      },
      select: {
        otp: true,
        otpExpires: true,
      },
    });

    if (!user || !user.otp || !user.otpExpires) {
      res.status(400).json({
        status: "error",
        payload: {
          message: "re-sign up.",
        },
      });
      return;
    }

    console.log("user.otp", user.otp, "code", code);

    if (code === user.otp) {
      if (user.otpExpires > new Date()) {
        try {
          await client.user.update({
            where: {
              email: email,
            },
            data: {
              verified: true,
              otp: null,
              otpExpires: null,
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
        privacyLevel: true,
        firstName: true,
        lastName: true,
        privateFName: true,
        privateLName: true,
      },
    });
    console.log(checkUser);

    if (checkUser) {
      const verifyPassword = await bcrypt.compare(password, checkUser.password);

      if (verifyPassword) {
        console.log("checkUser.verified");
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
                firstName: checkUser.firstName,
                lastName: checkUser.lastName,
                privateFName: checkUser.privateFName,
                privateLName: checkUser.privateLName,
                privacyLevel: checkUser.privacyLevel,
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
              message: "Email not verified.",
            },
          });
        }
      } else {
        res.status(401).json({
          status: "error",
          payload: {
            message: "Incorrect email or password",
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

export const updateProfilePic = async (req: Request, res: Response) => {
  const { token, profilePic } = req.body;

  // Validate required fields
  if (!token || !profilePic) {
    res.status(400).json({
      status: "error",
      payload: {
        message: "Token and profile picture URL are required",
      },
    });
    return;
  }

  try {
    // Find user by token
    const user = await client.user.findFirst({
      where: {
        session_token: token,
      },
    });

    if (!user) {
      res.status(401).json({
        status: "error",
        payload: {
          message: "Invalid or expired token",
        },
      });
      return;
    }

    // Update profile picture
    await client.user.update({
      where: {
        id: user.id,
      },
      data: {
        profilePic: profilePic,
      },
    });

    res.status(200).json({
      status: "success",
      payload: {
        message: "Profile picture updated successfully",
      },
    });
  } catch (e) {
    handleError(e, res);
    return;
  }
};

export const updatePrivacyLevel = async (req: Request, res: Response) => {
  const { token, privacyLevel } = req.body;

  // Validate required fields
  if (!token || privacyLevel === undefined) {
    res.status(400).json({
      status: "error",
      payload: {
        message: "Token and privacy level are required",
      },
    });
    return;
  }

  // Validate privacy level value
  if (![0, 1, 2].includes(privacyLevel)) {
    res.status(400).json({
      status: "error",
      payload: {
        message:
          "Privacy level must be 0 (public), 1 (friends), or 2 (private)",
      },
    });
    return;
  }

  try {
    // Find user by token
    const user = await client.user.findFirst({
      where: {
        session_token: token,
      },
    });

    if (!user) {
      res.status(401).json({
        status: "error",
        payload: {
          message: "Invalid or expired token",
        },
      });
      return;
    }

    // Update privacy level
    await client.user.update({
      where: {
        id: user.id,
      },
      data: {
        privacyLevel: privacyLevel,
      },
    });

    res.status(200).json({
      status: "success",
      payload: {
        message: "Privacy level updated successfully",
      },
    });
  } catch (e) {
    handleError(e, res);
    return;
  }
};
