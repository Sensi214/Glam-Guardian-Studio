import express from "express";
import Replicate from "replicate";
import Stripe from "stripe";

const app = express();
app.use(express.json({ limit: "10mb" }));

/* ------------------------------------------------
ENVIRONMENT
------------------------------------------------ */

const SECRET = process.env.SENSI_GS_SHARED_SECRET;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


/* ------------------------------------------------
CLIENT VERIFICATION
Protects AI endpoints from public abuse
------------------------------------------------ */

function verifyClient(req, res) {

  const clientSecret = req.headers["x-sensi-secret"];

  if (!clientSecret || clientSecret !== SECRET) {
    res.status(403).json({
      error: "Unauthorized request"
    });
    return false;
  }

  return true;

}


/* ------------------------------------------------
HEALTH CHECK
------------------------------------------------ */

app.get("/", (req, res) => {
  res.send("SENSI Glam Studio API running.");
});


/* ------------------------------------------------
STRIPE SESSION VERIFY
------------------------------------------------ */

app.post("/studio/verify", async (req, res) => {

  if (!verifyClient(req, res)) return;

  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({
      error: "Missing session_id"
    });
  }

  try {

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"]
    });

    const priceId = session.line_items.data[0].price.id;

    const priceMap = {

      // Tier 1
      "price_1SknL2GpqWf0TigzthxPyelU": "tier1",

      // Tier 2
      "price_1SknOpGpqWf0TigzpWYjScMp": "tier2",

      // Tier 3
      "price_1T7PFSGpqWf0TigzrPCD0q9k": "tier3",

      // Tier 4
      "price_1T7PHpGpqWf0TigzWoAIursl": "tier4",

      // Glam Studio
      "price_1T7fRlGpqWf0TigzoTC1utqr": "glam"

    };

    const tier = priceMap[priceId];

    if (!tier) {
      return res.status(400).json({
        error: "Unknown product purchased"
      });
    }

    res.json({
      success: true,
      tier: tier
    });

  } catch (error) {

    console.error("Stripe verification error:", error);

    res.status(500).json({
      error: "Stripe verification failed"
    });

  }

});


/* ------------------------------------------------
AI IMAGE GENERATION
------------------------------------------------ */

app.post("/generate-glam", async (req, res) => {

  if (!verifyClient(req, res)) return;

  const { image, style } = req.body;

  try {

    const promptMap = {

      magazine:
        "luxury fashion magazine cover, glam superhero, vogue editorial lighting, high fashion portrait",

      catwalk:
        "runway fashion model walking catwalk, glam superhero couture, dramatic runway lighting",

      redcarpet:
        "hollywood red carpet glamour portrait, celebrity flash photography, luxury fashion"

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

    console.error("AI image generation error:", error);

    res.status(500).json({
      error: "AI image generation failed"
    });

  }

});


/* ------------------------------------------------
AI VIDEO GENERATION
------------------------------------------------ */

app.post("/generate-video", async (req, res) => {

  if (!verifyClient(req, res)) return;

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

    console.error("AI video generation error:", error);

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
