import express from "express";
import Replicate from "replicate";
import Stripe from "stripe";
import cors from "cors";

const app = express();

app.use(cors({
  origin: ["https://sensianduniq.com","https://www.sensianduniq.com"],
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type","X-SENSI-SECRET"]
}));

app.use(express.json({ limit: "10mb" }));

const SECRET = process.env.SENSI_GS_SHARED_SECRET;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


/* SERVER STATUS */

app.get("/", (req,res)=>{
  res.send("SENSI Glam Studio API running.");
});


/* STRIPE VERIFY */

app.post("/studio/verify", async (req,res)=>{

  const clientSecret = req.headers["x-sensi-secret"];

  if(clientSecret !== SECRET){
    return res.status(403).json({error:"Unauthorized"});
  }

  const {session_id} = req.body;

  if(!session_id){
    return res.status(400).json({error:"Missing session_id"});
  }

  try{

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if(session.payment_status !== "paid"){
      return res.status(403).json({error:"Payment not complete"});
    }

    res.json({
      success:true,
      email: session.customer_details?.email || null
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      error:"Stripe verification failed"
    });

  }

});


/* AI IMAGE GENERATION */

app.post("/generate-glam", async (req,res)=>{

  const clientSecret = req.headers["x-sensi-secret"];

  if(clientSecret !== SECRET){
    return res.status(403).json({error:"Unauthorized"});
  }

  const {image,style} = req.body;

  try{

    const promptMap = {

      magazine:
      "luxury fashion magazine cover, glam superhero drag couture, vogue editorial lighting",

      catwalk:
      "high fashion runway model, drag superhero couture, dramatic runway lighting",

      redcarpet:
      "hollywood red carpet glam portrait, drag superhero couture, celebrity lighting"

    };

    const prompt = promptMap[style] || promptMap.magazine;

    const output = await replicate.run(
      "black-forest-labs/flux-dev",
      {
        input:{
          prompt:prompt,
          image:image
        }
      }
    );

    res.json({
      success:true,
      image:output
    });

  }catch(error){

    console.error(error);

    res.status(500).json({
      error:"AI generation failed"
    });

  }

});


/* SERVER START */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("SENSI Glam Studio server running on port " + PORT);
});
