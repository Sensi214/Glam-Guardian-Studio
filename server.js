import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;


/* ==============================
Replicate Setup
============================== */

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});


/* ==============================
Health Check
============================== */

app.get("/", (req, res) => {
  res.send("Sensi Glam Engine running");
});


/* ==============================
Security Check
============================== */

function verifySecret(req, res, next) {

  const secret = req.headers["x-sensi-secret"];

  if (secret !== process.env.SENSI_GS_SHARED_SECRET) {
    return res.status(403).json({
      error: "Forbidden"
    });
  }

  next();
}


/* ==============================
Guardian Generator
============================== */

app.post("/generate-guardian", verifySecret, async (req, res) => {

  try {

    const { hair, makeup, armor } = req.body;

    const basePrompt = `
luxury high fashion superhero,
met gala couture armor,
dramatic editorial lighting,
hair style ${hair},
makeup palette ${makeup},
armor design ${armor},
cinematic photography,
ultra detailed
`;

    /* ==============================
    Generate ONE Guardian Image
    ============================== */

    const output = await replicate.run(
      "stability-ai/sdxl:latest",
      {
        input: {
          prompt: basePrompt,
          width: 1024,
          height: 1024
        }
      }
    );

    /* Replicate returns an array */
    const image = output[0];

    /* ==============================
    Return Guardian Variants
    ============================== */

    res.json({

      heroCard: image,

      gala: image,

      magazine: image

    });

  } catch (err) {

    console.error("Generation error:", err);

    res.status(500).json({
      error: "Generation failed"
    });

  }

});


/* ==============================
Start Server
============================== */

app.listen(PORT, () => {

  console.log("Sensi Glam Engine running on port", PORT);

});
