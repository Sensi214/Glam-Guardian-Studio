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

const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const SHARED_SECRET = process.env.SENSI_GS_SHARED_SECRET;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!PUBLIC_BASE_URL) {
  throw new Error("Missing PUBLIC_BASE_URL environment variable.");
}

if (!SHARED_SECRET) {
  throw new Error("Missing SENSI_GS_SHARED_SECRET environment variable.");
}

if (!REPLICATE_API_TOKEN) {
  throw new Error("Missing REPLICATE_API_TOKEN environment variable.");
}

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "outputs");
const tmpDir = path.join(__dirname, "tmp");

[uploadsDir, outputDir, tmpDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use("/uploads", express.static(uploadsDir));
app.use("/outputs", express.static(outputDir));

const replicate = new Replicate({
  auth: REPLICATE_API_TOKEN
});

const stripe = new Stripe(STRIPE_SECRET_KEY);

/* =====================================
   Upload config
===================================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg") || ".jpg";
    const safeExt = ext.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)
      ? ext.toLowerCase()
      : ".jpg";
    cb(null, `selfie-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed."));
    }
    cb(null, true);
  }
});

/* =====================================
   Constants / Validation
===================================== */

const ALLOWED_HERO_CODES = [
  "MK", "PR", "SH", "FB", "LF", "VS", "CR", "MR", "JW"
];

const ALLOWED_GENDERS = ["Male", "Female"];

const ALLOWED_VARIANT_CODES = ["", "transcend", "glamguardian"];

const ALLOWED_HOST_FAMILIES = ["transcend", "glam-guardian"];

const ALLOWED_HOSTS = [
  "transcend-male",
  "transcend-female",
  "glam-male",
  "glam-female"
];

const ALLOWED_HAIR = [
  "Diamond Waves",
  "Platinum Crown",
  "Cosmic Bob",
  "Diamond Ice Waves",
  "Royal Glam Sweep",
  "Prism Crown Curls"
];

const ALLOWED_MAKEUP = [
  "solar-gold",
  "royal-gold",
  "diamond-silver",
  "cosmic-purple",
  "teal-mystic",
  "midnight-smoke",
  "lavender-dream",
  "rose-glam",
  "void-black",
  "Solar Gold",
  "Royal Amethyst",
  "Diamond Frost"
];

const ALLOWED_ARMOR = [
  "guardian-armor",
  "met-gala",
  "celestial",
  "Glam Guardian Armor",
  "Crystal Celestial Armor",
  "Met Gala Armor"
];

const HERO_PROMPTS = {
  MK: "The Memory Keeper. Theme: sacred memory, golden echoes, remembrance, wisdom, emotional preservation.",
  PR: "The Protector. Theme: defense, guardianship, shield energy, courage, steel-blue resilience.",
  SH: "The Shadow Healer. Theme: healing through shadow, violet mystery, emotional repair, soft underglow.",
  FB: "The Flamebearer. Theme: ignition, rebirth, fire, ember sparks, phoenix force.",
  LF: "The Loverfighter. Theme: passion, love, combat, red-gold energy, heartfire aura, dual flame symbolism.",
  VS: "The Visionary. Theme: foresight, indigo data-light, future sight, silver insight, elevated perception.",
  CR: "The Cosmic Rebel. Theme: rebellion, stardust, neon cosmos, ultraviolet freedom, anti-gravity force.",
  MR: "The Mirror. Theme: truth, reflection, silver-iridescent distortion, revelation, mirrored power.",
  JW: "The Joy Warrior. Theme: joy, pride-spectrum radiance, rainbow force, celebration, resilient happiness."
};

const VARIANT_PROMPTS = {
  "": "",
  transcend: "Variant shell: The Transcend. White-gold ascension, luminous grace, haloed purity, celestial rise.",
  glamguardian: "Variant shell: The Glam Guardian. Luxury drag queen superhero elegance, maroon-silver couture armor, polished beauty glow, editorial glam protector."
};

/* =====================================
   Helpers
===================================== */

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

function cleanValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateSelections(body = {}) {
  const heroCode = cleanValue(body.heroCode);
  const heroGender = cleanValue(body.heroGender);
  const variantCode = cleanValue(body.variantCode);
  const variantGender = cleanValue(body.variantGender);
  const tierCode = cleanValue(body.tierCode);

  const hostFamily = cleanValue(body.hostFamily);
  const host = cleanValue(body.host);
  const hair = cleanValue(body.hair);
  const makeup = cleanValue(body.makeup);
  const armor = cleanValue(body.armor);

  if (!ALLOWED_HERO_CODES.includes(heroCode)) {
    return { valid: false, error: "Invalid hero code." };
  }

  if (heroGender && !ALLOWED_GENDERS.includes(heroGender)) {
    return { valid: false, error: "Invalid hero gender." };
  }

  if (!ALLOWED_VARIANT_CODES.includes(variantCode)) {
    return { valid: false, error: "Invalid variant code." };
  }

  if (variantGender && !ALLOWED_GENDERS.includes(variantGender)) {
    return { valid: false, error: "Invalid variant gender." };
  }

  if (!ALLOWED_HOST_FAMILIES.includes(hostFamily)) {
    return { valid: false, error: "Invalid host family." };
  }

  if (!ALLOWED_HOSTS.includes(host)) {
    return { valid: false, error: "Invalid host." };
  }

  if (!ALLOWED_HAIR.includes(hair)) {
    return { valid: false, error: "Invalid hair selection." };
  }

  if (!ALLOWED_MAKEUP.includes(makeup)) {
    return { valid: false, error: "Invalid makeup selection." };
  }

  if (!ALLOWED_ARMOR.includes(armor)) {
    return { valid: false, error: "Invalid armor selection." };
  }

  return {
    valid: true,
    data: {
      heroCode,
      heroGender,
      variantCode,
      variantGender,
      tierCode,
      hostFamily,
      host,
      hair,
      makeup,
      armor
    }
  };
}

async function prepSelfie(inputPath) {
  const filename = `prepped-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  const outputPath = path.join(uploadsDir, filename);

  await sharp(inputPath)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "cover",
      position: "center"
    })
    .jpeg({
      quality: 92,
      mozjpeg: true
    })
    .toFile(outputPath);

  return {
    localPath: outputPath,
    publicUrl: `${PUBLIC_BASE_URL}/uploads/${filename}`
  };
}

function buildBasePrompt({
  heroCode,
  heroGender,
  variantCode,
  variantGender,
  hostFamily,
  host,
  hair,
  makeup,
  armor
}) {
  const heroPrompt = HERO_PROMPTS[heroCode] || "";
  const variantPrompt = VARIANT_PROMPTS[variantCode] || "";
  const expressionGender = variantCode ? (variantGender || heroGender) : heroGender;

  return `
Transform this selfie into a luxury drag queen superhero glam portrait.
Preserve the subject's facial identity, facial proportions, bone structure, skin tone, and recognizable features.
Keep the person looking like themselves.

Core hero identity: ${heroCode}.
${heroPrompt}

Visual expression gender: ${expressionGender || "unspecified"}.
${variantPrompt}

Host family: ${hostFamily}.
Character archetype: ${host}.
Hair style: ${hair}.
Makeup palette: ${makeup}.
Armor design: ${armor}.

The final character must read as the user's matched hero identity expressed through the selected variant shell and studio styling.
High-fashion editorial beauty.
Met Gala luxury superhero styling.
Polished cinematic lighting.
Elegant fantasy glamour.
Ultra detailed, premium, refined, aspirational.
No text, no watermark, no extra faces, no distorted hands.
`.trim();
}

function buildCardPrompt({ heroCode, variantCode, hostFamily, host }) {
  const heroPrompt = HERO_PROMPTS[heroCode] || "";
  const variantPrompt = VARIANT_PROMPTS[variantCode] || "";

  return `
Create a premium fantasy guardian portrait suitable for a black-and-gold Tier 4 collectible card.
Preserve the same person's facial identity and styling consistency.
Core hero identity: ${heroCode}.
${heroPrompt}
${variantPrompt}
Host family: ${hostFamily}.
Character archetype: ${host}.
Centered vertical composition, premium heroic framing, elegant lighting, collectible card art energy.
No text, no watermark.
`.trim();
}

function buildMetGalaPrompt({ heroCode, variantCode, hostFamily, host }) {
  const heroPrompt = HERO_PROMPTS[heroCode] || "";
  const variantPrompt = VARIANT_PROMPTS[variantCode] || "";

  return `
Transform into a Met Gala luxury superhero editorial portrait.
Preserve the same person's identity.
Core hero identity: ${heroCode}.
${heroPrompt}
${variantPrompt}
Host family: ${hostFamily}.
Character archetype: ${host}.
Red carpet glamour, couture armor, fashion photography, dramatic spotlight, dazzling beauty details.
No text, no watermark.
`.trim();
}

function buildMagazinePrompt({ heroCode, variantCode, hostFamily, host }) {
  const heroPrompt = HERO_PROMPTS[heroCode] || "";
  const variantPrompt = VARIANT_PROMPTS[variantCode] || "";

  return `
Create a glossy magazine-cover style beauty portrait.
Preserve the same person's identity.
Core hero identity: ${heroCode}.
${heroPrompt}
${variantPrompt}
Host family: ${hostFamily}.
Character archetype: ${host}.
High-fashion close portrait, clean cover composition, editorial lighting, glamorous beauty styling.
No text, no watermark.
`.trim();
}

async function getReplicateUrl(output) {
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0];
    if (typeof item === "string") return item;
    if (item && typeof item.url === "function") return await item.url();
  }

  if (typeof output === "string") {
    return output;
  }

  if (output && typeof output.url === "function") {
    return await output.url();
  }

  throw new Error("Replicate returned no usable image URL.");
}

async function runFluxEdit({ inputImageUrl, prompt }) {
  const output = await replicate.run(
    "black-forest-labs/flux-kontext-pro",
    {
      input: {
        input_image: inputImageUrl,
        prompt
      }
    }
  );

  return await getReplicateUrl(output);
}

/* =====================================
   Routes
===================================== */

app.get("/", (req, res) => {
  res.send("Sensi Glam Engine running");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "glam-guardian-studio",
    publicBaseUrl: PUBLIC_BASE_URL
  });
});

/* =====================================
   1) Base guardian from selfie
===================================== */

app.post(
  "/generate-base-guardian",
  verifySecret,
  upload.single("selfie"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Missing selfie upload."
        });
      }

      const validation = validateSelections(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const selections = validation.data;
      const prepped = await prepSelfie(req.file.path);
      const prompt = buildBasePrompt(selections);

      const basePortraitUrl = await runFluxEdit({
        inputImageUrl: prepped.publicUrl,
        prompt
      });

      return res.json({
        success: true,
        selections,
        input: {
          uploadedSelfie: `${PUBLIC_BASE_URL}/uploads/${path.basename(req.file.path)}`,
          preppedSelfie: prepped.publicUrl
        },
        outputs: {
          basePortrait: basePortraitUrl
        }
      });
    } catch (error) {
      console.error("Base guardian generation failed:", error);

      return res.status(500).json({
        success: false,
        error: "Base guardian generation failed."
      });
    }
  }
);

/* =====================================
   2) Full 3-image pack from selfie
===================================== */

app.post(
  "/generate-guardian-pack",
  verifySecret,
  upload.single("selfie"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Missing selfie upload."
        });
      }

      const validation = validateSelections(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const selections = validation.data;
      const prepped = await prepSelfie(req.file.path);

      const basePortraitUrl = await runFluxEdit({
        inputImageUrl: prepped.publicUrl,
        prompt: buildBasePrompt(selections)
      });

      const [tier4CardArt, metGalaImage, magazineImage] = await Promise.all([
        runFluxEdit({
          inputImageUrl: basePortraitUrl,
          prompt: buildCardPrompt(selections)
        }),
        runFluxEdit({
          inputImageUrl: basePortraitUrl,
          prompt: buildMetGalaPrompt(selections)
        }),
        runFluxEdit({
          inputImageUrl: basePortraitUrl,
          prompt: buildMagazinePrompt(selections)
        })
      ]);

      return res.json({
        success: true,
        selections,
        input: {
          uploadedSelfie: `${PUBLIC_BASE_URL}/uploads/${path.basename(req.file.path)}`,
          preppedSelfie: prepped.publicUrl
        },
        outputs: {
          basePortrait: basePortraitUrl,
          tier4CardArt,
          metGalaImage,
          magazineImage
        }
      });
    } catch (error) {
      console.error("Guardian pack generation failed:", error);

      return res.status(500).json({
        success: false,
        error: "Guardian pack generation failed."
      });
    }
  }
);

/* =====================================
   3) Stripe session verification
===================================== */

app.get("/verify-session", async (req, res) => {
  try {
    const sessionId =
      typeof req.query.session_id === "string"
        ? req.query.session_id.trim()
        : "";

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing session_id"
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session.payment_status === "paid";

    return res.json({
      success: true,
      paid: isPaid,
      sessionId,
      status: session.payment_status || "unpaid",
      customerEmail: session.customer_details?.email || null
    });
  } catch (error) {
    console.error("Stripe session verification failed:", error);

    return res.status(500).json({
      success: false,
      error: "Stripe verification failed."
    });
  }
});

/* =====================================
   Start
===================================== */

app.listen(PORT, () => {
  console.log(`Glam Guardian Studio running on port ${PORT}`);
});
