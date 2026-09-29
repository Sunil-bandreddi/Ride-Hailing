import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAuthToken = (payload) => jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
export const verifyAuthToken = (token) => jwt.verify(token, env.jwtSecret);
