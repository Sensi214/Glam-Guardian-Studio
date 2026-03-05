import express from "express";
import Replicate from "replicate";
import Stripe from "stripe";

const app = express();
app.use(express.json({ limit: "10mb" }));

/* ------------------------------------------------
ENV VARIABLES
------------------------------------------------ */

const SECRET = process.env.SENSI_GS_SHARED_SECRET;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


/* ------------------------------------------------
SERVER STATUS
------------------------------------------------ */

app.get("/", (req, res) => {
  res.send("SENSI Glam Studio API running.");
});


/* ------------------------------------------------
STRIPE SESSION VERIFY
------------------------------------------------ */

app.post("/studio/verify", async (req, res) => {

  const clientSecret = req.headers["x-sensi-secret"];

  if (clientSecret !== SECRET) {
    return res.status(403).json({ error: "Unauthorized request" });
  }

  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  try {

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(403).json({ error: "Payment not completed" });
    }

    res.json({
      success: true,
      email: session.customer_details?.email || null
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Stripe verification failed"
    });

  }

});


/* ------------------------------------------------
AI IMAGE GENERATION
------------------------------------------------ */

app.post("/generate-glam", async (req, res) => {

  const clientSecret = req.headers["x-sensi-secret"];

  if (clientSecret !== SECRET) {
    return res.status(403).json({ error: "Unauthorized request" });
  }

  const { image, style } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Missing image" });
  }

  try {

    const promptMap = {

      magazine:
        "luxury fashion magazine cover, high fashion drag superhero, vogue editorial lighting, couture styling, dramatic makeup",

      catwalk:
        "runway fashion model walking catwalk, glam drag superhero couture, dramatic runway lighting, fashion week editorial",

      redcarpet:
        "hollywood red carpet glamour portrait, celebrity flash photography, drag superhero couture, luxury fashion",

      vogue:
        "vogue editorial fashion portrait, high fashion drag queen superhero, studio lighting, couture outfit"

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

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

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
  console.log(`SENSI Glam Studio server running on port ${PORT}`);
});
