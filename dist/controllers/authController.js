"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logIn = exports.verify = exports.signUp = void 0;
const client_1 = require("@prisma/client");
const generateHash_1 = require("../utils/generateHash");
const bcrypt_1 = __importDefault(require("bcrypt"));
const handleErrors_1 = __importDefault(require("../utils/handleErrors"));
const handleOtp_1 = __importDefault(require("../utils/handleOtp"));
const client = new client_1.PrismaClient();
const otpMap = new Map();
const signUp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, password } = req.body;
    try {
        const ifExist = yield client.user.findFirst({
            where: {
                email: email
            }
        });
        if (!ifExist) {
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            const newUser = yield client.user.create({
                data: {
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: hashedPassword
                },
                select: {
                    id: true
                }
            });
            const otp = (0, generateHash_1.generateOtp)();
            otpMap.set(email, { otp: otp, expiresAt: Date.now() + 5 * 60 * 1000 });
            yield (0, handleOtp_1.default)({ otp, email, res });
            res.status(201).json({
                "status": "success",
                "payload": {
                    message: "Verification email sent."
                }
            });
        }
        else {
            res.status(409).json({
                status: "error",
                payload: {
                    message: "email already in use"
                }
            });
        }
        return;
    }
    catch (e) {
        (0, handleErrors_1.default)(e, res);
        return;
    }
});
exports.signUp = signUp;
const verify = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, code } = req.body;
    try {
        const body = otpMap.get(email) || {};
        if (body.length === 0) {
            res.status(400).json({
                status: "error",
                payload: {
                    message: "re-sign up."
                }
            });
            return;
        }
        if (code === body.otp) {
            if (Date.now() <= body.expiresAt) {
                try {
                    yield client.user.update({
                        where: {
                            email: email
                        }, data: {
                            verified: true
                        }
                    });
                    res.status(200).json({
                        status: "success",
                        payload: {
                            message: "Email verified. You can now log in."
                        }
                    });
                }
                catch (e) {
                    (0, handleErrors_1.default)(e, res);
                }
                return;
            }
            else {
                res.status(400).json({
                    status: "error",
                    payload: {
                        message: "Otp expired, Retry."
                    }
                });
            }
        }
        else {
            res.status(400).json({
                status: "error",
                payload: {
                    message: "Wrong otp."
                }
            });
        }
    }
    catch (e) {
        console.log(e.message);
        (0, handleErrors_1.default)(e, res);
        return;
    }
});
exports.verify = verify;
const logIn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const checkUser = yield client.user.findFirst({
            where: {
                email: email
            },
            select: {
                password: true,
                verified: true
            }
        });
        if (checkUser) {
            const verifyPassword = yield bcrypt_1.default.compare(password, checkUser.password);
            if (verifyPassword) {
                if (checkUser.verified) {
                    const token = (0, generateHash_1.generateToken)();
                    try {
                        yield client.user.update({
                            where: {
                                email: email
                            }, data: {
                                session_token: token
                            }
                        });
                        res.status(200).json({
                            status: "success",
                            payload: {
                                message: 'Signed in successfully',
                                token
                            }
                        });
                    }
                    catch (e) {
                        (0, handleErrors_1.default)(e, res);
                        return;
                    }
                }
                else {
                    res.status(401).json({
                        status: "error",
                        payload: {
                            message: "Unautorised access/incorrect password"
                        }
                    });
                }
            }
            else {
                res.status(401).json({
                    status: "error",
                    payload: {
                        message: "Email not verified."
                    }
                });
            }
        }
        else {
            res.status(404).json({
                staus: "error",
                payload: {
                    message: "Invalid email"
                }
            });
        }
        return;
    }
    catch (e) {
        (0, handleErrors_1.default)(e, res);
        return;
    }
});
exports.logIn = logIn;
