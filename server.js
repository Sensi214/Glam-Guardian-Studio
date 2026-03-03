const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Glam Guardian Studio is live 👑🔥");
});

app.get("/studio", (req, res) => {
  res.send("Welcome to the Glam Guardian Studio");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
