import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";

const app = express();

//Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


//Routes 
// // Add this right above app.use("/api/auth", authRoutes);
app.post("/api/test", (req, res) => {
    res.json({ message: "Post is working!" });
});
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);


export default app;
