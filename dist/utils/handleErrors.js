"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = require("jsonwebtoken");
const library_1 = require("@prisma/client/runtime/library");
const smtp_connection_1 = __importDefault(require("nodemailer/lib/smtp-connection"));
const handleError = (e, res) => {
    var _a, _b;
    if (e instanceof client_1.Prisma.PrismaClientInitializationError) {
        console.log('database connection issue: ', e.message);
        res.status(500).json({
            status: "error",
            payload: {
                message: "Error connectong to database"
            }
        });
    }
    else if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") {
            console.log("Uniqueness constraint failed", e.message, e.code);
            res.status(409).json({
                status: "error",
                payload: {
                    message: "Uniqueness constraint failed/ verify sensitive data",
                    field: (_a = e.meta) === null || _a === void 0 ? void 0 : _a.target
                }
            });
        }
        else if (e.code === "P2025") {
            console.log("Deletion operation failed as dependent field not passed", e.message);
            res.status(404).json({
                status: "error",
                payload: {
                    message: "Delete request failed as object not found",
                    field: (_b = e.meta) === null || _b === void 0 ? void 0 : _b.target
                }
            });
        }
        else {
            console.log("Input error ", e.message);
            res.status(400).json({
                status: "error",
                payload: {
                    message: "Invalid input provided"
                }
            });
        }
    }
    else if (e instanceof library_1.PrismaClientValidationError) {
        console.log("Unauthorized access", e.message);
        res.status(409).json({
            status: "error",
            payload: {
                message: "Bad request",
                field: e
            }
        });
    }
    else if (e instanceof jsonwebtoken_1.TokenExpiredError) {
        console.log("Session expired");
        res.status(401).json({
            status: "error",
            payload: {
                message: "Session expired// Re-login"
            }
        });
    }
    else if (e instanceof jsonwebtoken_1.JsonWebTokenError) {
        console.log("Invalid token");
        res.status(401).json({
            status: "error",
            payload: {
                message: "Unauthorized access"
            }
        });
    }
    else if (e.code === 'ESOCKET' || e.code === 'ETIMEDOUT') {
        console.log('Timeout error:', e.message);
        res.status(500).json({
            status: 'error',
            payload: { message: 'Timeout error. Try again later.' }
        });
    }
    else if (e instanceof smtp_connection_1.default) {
        console.log("Error sending otp");
        res.status(400).json({
            status: "error",
            payload: {
                message: "error sending the Otp"
            }
        });
    }
    else if (e.name === 'SMTPAuthError') {
        console.log('Authentication failed:', e.message);
        res.status(401).json({
            status: 'error',
            payload: { message: 'Invalid email or password.' }
        });
    }
    else if (e.code === "EENVOLOPE") {
        console.log("Invalid email address: ", e.message);
        res.status(400).json({
            status: 'error',
            payload: { message: 'Invalid recipient email.' }
        });
    }
    else {
        console.log("Unkown error: ", e);
        res.status(500).json({
            status: "error",
            payload: {
                message: "Server/Backend error"
            }
        });
    }
    return;
};
exports.default = handleError;
