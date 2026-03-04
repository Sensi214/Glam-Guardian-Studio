import express from "express";
import Replicate from "replicate";

const app = express();
app.use(express.json({ limit: "10mb" }));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const SECRET = process.env.SENSI_GS_SHARED_SECRET;

/* ------------------------------------------------
AI IMAGE GENERATION
------------------------------------------------ */

app.post("/generate-glam", async (req, res) => {

  const clientSecret = req.headers["x-sensi-secret"];

  if (clientSecret !== SECRET) {
    return res.status(403).json({ error: "Unauthorized request" });
  }

  const { image, style } = req.body;

  try {

    const promptMap = {
      magazine: "luxury fashion magazine cover, glam superhero, vogue editorial lighting, high fashion portrait",
      catwalk: "runway fashion model walking catwalk, glam superhero couture, dramatic runway lighting",
      redcarpet: "hollywood red carpet glamour portrait, celebrity flash photography, luxury fashion"
    };

    const prompt = promptMap[style] || promptMap.magazine;

    const output = await replicate.run(
      "black-forest-labs/flux-dev",
      {
        input: {
          prompt: prompt,
          image: image
        }
      }
    );

    res.json({
      success: true,
      image: output
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "AI image generation failed"
    });

  }

});

/* ------------------------------------------------
AI VIDEO GENERATION
------------------------------------------------ */

app.post("/generate-video", async (req, res) => {

  const clientSecret = req.headers["x-sensi-secret"];

  if (clientSecret !== SECRET) {
    return res.status(403).json({ error: "Unauthorized request" });
  }

  const { prompt } = req.body;

  try {

    const output = await replicate.run(
      "cerspense/zeroscope-v2-xl",
      {
        input: {
          prompt: prompt,
          width: 768,
          height: 768,
          num_frames: 24,
          fps: 8
        }
      }
    );

    res.json({
      success: true,
      video: output
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "AI video generation failed"
    });

  }

});

/* ------------------------------------------------
SERVER START
------------------------------------------------ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SENSI Glam Studio server running on port " + PORT);
});
