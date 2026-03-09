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

app.get("/", (req,res)=>{
  res.send("Sensi Glam Engine running");
});


/* ==============================
Security Check
============================== */

function verifySecret(req,res,next){

  const secret = req.headers["x-sensi-secret"];

  if(secret !== process.env.SENSI_GS_SHARED_SECRET){
    return res.status(403).json({ error:"Forbidden" });
  }

  next();
}


/* ==============================
AI Generator
============================== */

async function generate(prompt){

  const output = await replicate.run(
    "stability-ai/sdxl:39ed52f2a78e934c7b0df13c42b13b0e88a41c54e0de7e5c6eecb22d0e8d7e33",
    {
      input:{
        prompt: prompt,
        width:1024,
        height:1024
      }
    }
  );

  return output[0];

}


/* ==============================
Guardian Generator
============================== */

app.post("/generate-guardian", verifySecret, async (req,res)=>{

  try{

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


    const heroCard = await generate(
      basePrompt + ", collectible superhero trading card design"
    );

    const gala = await generate(
      basePrompt + ", red carpet arrival, paparazzi flash photography"
    );

    const magazine = await generate(
      basePrompt + ", fashion magazine cover portrait, vogue style"
    );

    const poster = await generate(
      basePrompt + ", cinematic superhero movie poster, epic lighting, dramatic background"
    );


    res.json({
      heroCard,
      gala,
      magazine,
      poster
    });


  }catch(err){

    console.error("Generation error:",err);

    res.status(500).json({
      error:"Generation failed"
    });

  }

});


/* ==============================
Start Server
============================== */

app.listen(PORT, ()=>{

  console.log("Sensi Glam Engine running on port", PORT);

});
