import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import apiRoutes from "./routes/apiRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/api", apiRoutes);

app.listen(2233, () => {
  console.log("Server started at port 2233");
});
