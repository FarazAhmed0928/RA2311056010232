require('dotenv').config()
const express = require('express')
const logger = require('./logger')

const app = express()
app.use(express.json())
app.use(logger)

console.log("logging middleware server starting...")

app.get('/', (req, res) => {
  res.status(200).json({ message: 'logging middleware is active' })
})

app.get('/test', (req, res) => {
  console.log("test route hit")
  res.status(200).json({ message: 'test route working' })
})

app.post('/test', (req, res) => {
  console.log("post request received, body:", req.body)
  res.status(201).json({ message: 'post received', body: req.body })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`logger running on port ${PORT}`)
})