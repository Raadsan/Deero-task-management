import { PrismaClient } from "../../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

export const prisma = new PrismaClient();
