import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();   // MUST come before any app.get/app.post

app.use(cors());
app.use(express.json());
