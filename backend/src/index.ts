import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { evaluateRouter } from "./evaluate";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/evaluate", evaluateRouter);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Pitch Perfect backend listening at http://localhost:${port}`);
});
