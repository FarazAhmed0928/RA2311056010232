require('dotenv').config()
const express = require('express')
const axios = require('axios')

const logger = require('./logger')
app.use(logger)

const app = express()
app.use(express.json())

const TOKEN = process.env.ACCESS_TOKEN
const BASE_URL = 'http://20.207.122.201/evaluation-service'

console.log("notification server starting...")
console.log("token loaded?", TOKEN ? "yes" : "no")

// priority weights - placement is most important
const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
}

// calculate score based on type and recency
const getPriorityScore = (notification) => {
  const typeWeight = TYPE_WEIGHT[notification.Type] || 0
  const now = new Date()
  const created = new Date(notification.Timestamp)
  const ageInMinutes = (now - created) / 1000 / 60

  // newer notifications get higher recency score
  const recencyScore = Math.max(0, 100 - ageInMinutes * 0.1)

  const finalScore = typeWeight * 10 + recencyScore
  return finalScore
}

// get top N notifications sorted by priority
const getTopN = (notifications, n) => {
  console.log(`total notifications: ${notifications.length}`)
  console.log(`calculating priority scores...`)

  const scored = notifications.map(notif => {
    const score = getPriorityScore(notif)
    console.log(`[${notif.Type}] ${notif.Message} -> score: ${score.toFixed(2)}`)
    return { ...notif, priorityScore: parseFloat(score.toFixed(2)) }
  })

  // sort highest score first
  scored.sort((a, b) => b.priorityScore - a.priorityScore)

  const topN = scored.slice(0, n)
  console.log(`top ${n} selected successfully`)
  return topN
}

// main route - get top 10 priority notifications
app.get('/priority', async (req, res) => {
  console.log("\nrequest received at /priority")

  try {
    console.log("fetching notifications from evaluation server...")
    const response = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })

    const notifications = response.data.notifications
    console.log("notifications fetched:", notifications.length)

    const top10 = getTopN(notifications, 10)

    res.status(200).json({
      success: true,
      totalFetched: notifications.length,
      top10: top10
    })

  } catch (err) {
    console.log("something went wrong:", err.message)
    console.log("status:", err.response?.status)

    if (!err.response) {
      return res.status(500).json({ error: 'No response from upstream API' })
    }

    res.status(500).json({
      error: 'Failed to fetch notifications',
      details: err.response.data
    })
  }
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => {
  console.log(`notification server running on port ${PORT}`)
  console.log(`test: http://localhost:${PORT}/priority`)
})