import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();

app.use(cors());
app.use(express.json());

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const PORT = process.env.PORT || 3000;

app.get("/", (req,res)=>{
  res.send("Sensi Glam Engine running");
});

function verifySecret(req,res,next){

  const secret = req.headers["x-sensi-secret"];

  if(secret !== process.env.SENSI_GS_SHARED_SECRET){
    return res.status(403).json({error:"Forbidden"});
  }

  next();
}

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

    async function generate(prompt){

      const output = await replicate.run(
        "stability-ai/sdxl",
        {
          input:{
            prompt:prompt,
            width:1024,
            height:1024
          }
        }
      );

      return output[0];
    }

    const [heroCard,gala,magazine] = await Promise.all([

      generate(basePrompt + " collectible hero trading card design"),

      generate(basePrompt + " full body red carpet gala arrival photographers flashing"),

      generate(basePrompt + " fashion magazine cover portrait")

    ]);

    res.json({
      heroCard,
      gala,
      magazine
    });

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Generation failed"});

  }

});

app.listen(PORT, ()=>{
  console.log("Sensi Glam Engine running");
});
