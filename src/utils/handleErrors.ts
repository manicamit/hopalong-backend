import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

const handleError = (e: any, res: Response) => {

    if (e instanceof Prisma.PrismaClientInitializationError) {
        console.log('database connection issue: ', e.message);
        res.status(500).json({
            status: "error",
            payload: {
                message: "Error connectong to database"
            }
        });

    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
            console.log("Uniqueness constraint failed", e.message, e.code);
            res.status(409).json({
                status: "error",
                payload: {
                    message: "Uniqueness constraint failed/ verify sensitive data",
                    field: e.meta?.target
                }

            })
        } else if (e.code === "P2025") {
            console.log("Deletion operation failed as dependent field not passed", e.message);
            res.status(404).json({
                status: "error",
                payload: {
                    message: "Delete request failed as object not found",
                    field: e.meta?.target
                }


            })

        } else {
            console.log("Input error ", e.message);
            res.status(400).json({

                status: "error",
                payload: {
                    message: "Invalid input provided"
                }

            })
        }

    } else if (e instanceof PrismaClientValidationError) {
        console.log("Unauthorized access", e.message);
        res.status(409).json({

            status: "error",
            payload: {
                message: "Bad request",
                field: e
            }

        })

    } else if (e instanceof TokenExpiredError) {
        console.log("Session expired");
        res.status(401).json({
            status: "error",
            payload: {
                message: "Session expired// Re-login"
            }


        });

    } else if (e instanceof JsonWebTokenError) {
        console.log("Invalid token");
        res.status(401).json({
            status: "error",
            payload: {
                message: "Unauthorized access"
            }
        })
    }else if (e.code === 'ESOCKET' || e.code === 'ETIMEDOUT') {
        console.log('Timeout error:', e.message);
        res.status(500).json({
          status: 'error',
          payload: { message: 'Timeout error. Try again later.' }
        });
    }else if(e instanceof SMTPConnection){
        console.log("Error sending otp");
        res.status(400).json({
            status : "error",
            payload : {
                message : "error sending the Otp"
            }
        })
    }else if (e.name === 'SMTPAuthError') {
        console.log('Authentication failed:', e.message);
        res.status(401).json({
          status: 'error',
          payload: { message: 'Invalid email or password.' }
    });
    }else if(e.code === "EENVOLOPE"){
        console.log("Invalid email address: ", e.message);
        res.status(400).json({
            status: 'error',
            payload: { message: 'Invalid recipient email.' }
        });
    }else {
        console.log("Unkown error: ", e)
        res.status(500).json({
            status: "error",
            payload: {
                message: "Server/Backend error"
            }

        })

    } return;
}

export default handleError;