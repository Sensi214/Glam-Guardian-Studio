import express from "express"
import cors from "cors"
import Replicate from "replicate"

const app = express()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

const SECRET = process.env.SENSI_SECRET || "N9d8K2sF4pQ7xLmT6rV1zYwB5aH3cE8jU0gP2mK7"

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

app.get("/", (req, res) => {
  res.send("SENSI Glam Engine running")
})

app.post("/generate-guardian", async (req, res) => {

  const clientSecret = req.headers["x-sensi-secret"]

  if (clientSecret !== SECRET) {
    return res.status(403).json({ error: "Unauthorized" })
  }

  try {

    const { hair, makeup, armor } = req.body

    const prompt = `
Ultra high fashion glam superhero portrait,
${hair} hairstyle,
${makeup} makeup,
${armor},
met gala level styling,
studio lighting,
editorial photography,
8k ultra detailed
`

    const output = await replicate.run(
      "stability-ai/sdxl:latest",
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024
        }
      }
    )

    const image = output[0]

    res.json({
      heroCard: image,
      gala: image,
      magazine: image
    })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      error: "AI generation failed"
    })

  }

})

app.listen(PORT, () => {
  console.log(`SENSI Glam Studio running on port ${PORT}`)
})
