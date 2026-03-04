import express from "express";
import Replicate from "replicate";

const app = express();
app.use(express.json({ limit: "10mb" }));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const SECRET = process.env.SENSI_GS_SHARED_SECRET;

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
      error: "AI generation failed"
    });

  }

});

app.listen(3000, () => {
  console.log("SENSI Glam Studio server running");
});
