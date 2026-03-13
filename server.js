import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import Replicate from "replicate";
import Stripe from "stripe";
import { fileURLToPath } from "url";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* serve frontend */
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

/* shared secret support */
const SHARED_SECRET =
  process.env.SENSI_GS_SHARED_SECRET ||
  process.env.SENSI_GUARDIAN_SHARED_SECRET ||
  process.env.SENSI_SHARED_SECRET;

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const REPLICATE_MODEL =
  process.env.REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro";

if (!PUBLIC_BASE_URL) throw new Error("Missing PUBLIC_BASE_URL");
if (!SHARED_SECRET) throw new Error("Missing shared secret");
if (!REPLICATE_API_TOKEN) throw new Error("Missing REPLICATE_API_TOKEN");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");

[uploadsDir, outputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use("/uploads", express.static(uploadsDir));
app.use("/outputs", express.static(outputDir));

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/* =================================
UPLOAD
================================ */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `selfie-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }
});

/* =================================
SECURITY
================================ */

function verifySecret(req, res, next) {
  const secret = req.headers["x-sensi-secret"];

  if (!secret || secret !== SHARED_SECRET) {
    return res.status(403).json({
      success: false,
      error: "Forbidden"
    });
  }

  next();
}

/* =================================
IMAGE HELPERS
================================ */

async function prepSelfie(inputPath) {
  const filename = `prepped-${Date.now()}.jpg`;
  const outputPath = path.join(uploadsDir, filename);

  await sharp(inputPath)
    .resize(1024, 1024)
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  return {
    localPath: outputPath,
    publicUrl: `${PUBLIC_BASE_URL}/uploads/${filename}`
  };
}

async function getReplicateUrl(output) {
  if (Array.isArray(output)) {
    const item = output[0];
    if (typeof item === "string") return item;
    if (item.url) return await item.url();
  }

  if (typeof output === "string") return output;
  if (output.url) return await output.url();

  throw new Error("No usable replicate output");
}

async function runFluxEdit(inputImageUrl, prompt) {
  const output = await replicate.run(REPLICATE_MODEL, {
    input: {
      input_image: inputImageUrl,
      prompt
    }
  });

  return await getReplicateUrl(output);
}

/* =================================
PROMPTS
================================ */

function basePrompt({ host, hair, makeup, armor }) {
  return `
clean luxury superhero portrait
preserve same facial identity
remove facial hair
cinematic lighting
drag queen superhero glam
hair style: ${hair}
makeup: ${makeup}
armor: ${armor}
hero archetype: ${host}
high fashion fantasy
no watermark
`;
}

function cardPrompt(host) {
  return `
epic collectible hero card portrait
same character
hero archetype ${host}
fantasy card art
dramatic lighting
`;
}

function metGalaPrompt(host) {
  return `
met gala superhero couture portrait
same character
hero archetype ${host}
luxury fashion editorial
`;
}

function magazinePrompt(host) {
  return `
glossy magazine cover portrait
same character
hero archetype ${host}
high fashion beauty portrait
`;
}

/* =================================
ROUTES
================================ */

app.get("/", (req, res) => {
  res.send("Sensi Glam Engine running");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    replicateModel: REPLICATE_MODEL,
    stripeEnabled: !!stripe
  });
});

/* =================================
BASE GUARDIAN
================================ */

app.post(
  "/generate-base-guardian",
  verifySecret,
  upload.single("selfie"),
  async (req, res) => {
    try {
      const selfie = await prepSelfie(req.file.path);

      const image = await runFluxEdit(
        selfie.publicUrl,
        basePrompt(req.body)
      );

      res.json({
        success: true,
        basePortrait: image
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Generation failed"
      });
    }
  }
);

/* =================================
FULL GUARDIAN PACK
================================ */

app.post(
  "/generate-guardian-pack",
  verifySecret,
  upload.single("selfie"),
  async (req, res) => {
    try {
      const selfie = await prepSelfie(req.file.path);

      const base = await runFluxEdit(
        selfie.publicUrl,
        basePrompt(req.body)
      );

      const [card, gala, magazine] = await Promise.all([
        runFluxEdit(base, cardPrompt(req.body.host)),
        runFluxEdit(base, metGalaPrompt(req.body.host)),
        runFluxEdit(base, magazinePrompt(req.body.host))
      ]);

      res.json({
        success: true,
        outputs: {
          basePortrait: base,
          tier4Card: card,
          metGala: gala,
          magazine: magazine
        }
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Guardian pack failed"
      });
    }
  }
);

/* =================================
HOST VIDEO GENERATOR
================================ */

app.post(
  "/generate-host-video",
  verifySecret,
  upload.single("image"),
  async (req, res) => {
    try {
      const script = req.body.script || "";

      const imageUrl =
        `${PUBLIC_BASE_URL}/uploads/${path.basename(req.file.path)}`;

      const video = await replicate.run(
        "lucataco/animate-diff",
        {
          input: {
            image: imageUrl,
            prompt: script
          }
        }
      );

      const videoUrl = await getReplicateUrl(video);

      res.json({
        success: true,
        video: videoUrl
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        error: "Video generation failed"
      });
    }
  }
);

/* =================================
STRIPE VERIFY
================================ */

app.get("/verify-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false
      });
    }

    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id
    );

    res.json({
      success: true,
      paid: session.payment_status === "paid"
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false
    });
  }
});

/* =================================
START SERVER
================================ */

app.listen(PORT, () => {
  console.log(`Guardian Engine running on ${PORT}`);
});
