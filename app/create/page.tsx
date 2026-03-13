"use client"

import { useState } from "react"

export default function CreateHero() {

  const [image,setImage] = useState("")
  const [archetype,setArchetype] = useState("protector")
  const [result,setResult] = useState(null)

  async function generateHero(){

    const res = await fetch("/api/generate",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        image,
        archetype
      })
    })

    const data = await res.json()

    setResult(data.image)
  }

  return (

    <div style={{padding:40}}>

      <h1>THE TRANSCEND</h1>
      <p>Create Your Hero</p>

      <input
        placeholder="Paste selfie image URL"
        onChange={(e)=>setImage(e.target.value)}
      />

      <br/><br/>

      <select
        value={archetype}
        onChange={(e)=>setArchetype(e.target.value)}
      >

        <option value="protector">Protector</option>
        <option value="visionary">Visionary</option>
        <option value="joy-warrior">Joy Warrior</option>

      </select>

      <br/><br/>

      <button onClick={generateHero}>
        Generate Hero
      </button>

      <br/><br/>

      {result && (
        <img src={result} width={400}/>
      )}

    </div>
  )
}
