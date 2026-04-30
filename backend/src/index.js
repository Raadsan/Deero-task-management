// import dotenv from "dotenv";
// dotenv.config();
// import express from "express";
// import cors from "cors";
// import { auth } from "./lib/auth.js";
// import { toNodeHandler } from "better-auth/node";
// import userRoutes from "./routes/userrouter.js";
// import authRoutes from "./routes/authrouter.js";
// import clientRoutes from "./routes/clientrouter.js";
// import taskRoutes from "./routes/taskrouter.js";
// import serviceRoutes from "./routes/servicerouter.js";
// import transactionRoutes from "./routes/transactionrouter.js";
// import salaryRoutes from "./routes/salaryrouter.js";
// import roleRoutes from "./routes/rolerouter.js";
// import utilRoutes from "./routes/utilrouter.js";
// import notificationRoutes from "./routes/notificationrouter.js";



// const app = express();
// const port = process.env.PORT || 700;

// app.use(cors({
//   origin: process.env.FRONTEND_URL || "http://localhost:3000",
//   credentials: true
// }));
// app.use(express.json());

// // Better Auth integration
// app.all("/api/auth/*", toNodeHandler(auth));

// // Routes
// app.use("/api/users", userRoutes);
// app.use("/api/auth-custom", authRoutes);
// app.use("/api/clients", clientRoutes);
// app.use("/api/tasks", taskRoutes);
// app.use("/api/services", serviceRoutes);
// app.use("/api/transactions", transactionRoutes);
// app.use("/api/salaries", salaryRoutes);
// app.use("/api/roles", roleRoutes);
// app.use("/api/utils", utilRoutes);
// app.use("/api/notifications", notificationRoutes);

// app.get("/", (req, res) => {
//   res.send("Deero Management API is running...");
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });





import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const frontendUrl = isProduction
  ? process.env.FRONTEND_URL_PROD
  : process.env.FRONTEND_URL;

import express from "express";
import cors from "cors";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";

import userRoutes from "./routes/userrouter.js";
import authRoutes from "./routes/authrouter.js";
import clientRoutes from "./routes/clientrouter.js";
import taskRoutes from "./routes/taskrouter.js";
import serviceRoutes from "./routes/servicerouter.js";
import transactionRoutes from "./routes/transactionrouter.js";
import salaryRoutes from "./routes/salaryrouter.js";
import roleRoutes from "./routes/rolerouter.js";
import utilRoutes from "./routes/utilrouter.js";
import notificationRoutes from "./routes/notificationrouter.js";

const app = express();
const port = process.env.PORT || 7003;

app.use(cors({
  origin: frontendUrl,
  credentials: true
}));

app.use(express.json());

app.all("/api/auth/*", toNodeHandler(auth));

app.use("/api/users", userRoutes);
app.use("/api/auth-custom", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/utils", utilRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Deero Management API is running...");
});

// 👇 muhiim
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});