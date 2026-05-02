require('dotenv').config()
const express = require('express')
const { fetchDepots, fetchVehicles } = require('./apiservice')
const { runScheduler } = require('./scheduler')


const app = express()
app.use(express.json())

const logger = require('./logger')
app.use(logger)

const TOKEN = process.env.ACCESS_TOKEN

console.log("server starting up...")
console.log("token loaded?", TOKEN ? "yes" : "no")

// formats the result for each depot nicely
const formatDepotResult = (depot, selectedTasks, maxImpact, totalDuration) => {
  return {
    depotID: depot.ID,
    mechanicHoursBudget: depot.MechanicHours,
    maxImpactScore: maxImpact,
    totalDurationUsed: totalDuration,
    selectedTasks: selectedTasks.map(t => ({
      taskID: t.TaskID,
      duration: t.Duration,
      impact: t.Impact
    }))
  }
}

// process all depots one by one
const processAllDepots = (depots, vehicles) => {
  console.log(`processing ${depots.length} depots...`)
  const results = []

  for (let i = 0; i < depots.length; i++) {
    const depot = depots[i]
    console.log(`\n--- depot ${depot.ID} | budget: ${depot.MechanicHours} hours ---`)

    const { maxImpact, selectedTasks, totalDuration } = runScheduler(vehicles, depot.MechanicHours)

    const formatted = formatDepotResult(depot, selectedTasks, maxImpact, totalDuration)
    console.log(`depot ${depot.ID} result - impact: ${maxImpact}, hours used: ${totalDuration}`)

    results.push(formatted)
  }

  console.log("all depots processed successfully")
  return results
}

// main schedule route
app.get('/schedule', async (req, res) => {
  console.log("\nnew request received at /schedule")

  try {
    // fetch data from evaluation server
    const depots = await fetchDepots(TOKEN)
    console.log("depots loaded:", depots.length)

    const vehicles = await fetchVehicles(TOKEN)
    console.log("vehicles loaded:", vehicles.length)

    // run the scheduler for all depots
    const results = processAllDepots(depots, vehicles)

    console.log("sending final response...")
    res.status(200).json({ success: true, results })

  } catch (err) {
    console.log("error occurred:", err.message)
    console.log("error status:", err.response?.status)
    console.log("error data:", err.response?.data)

    if (!err.response) {
      return res.status(500).json({
        error: 'Failed to fetch or process data',
        details: 'No response received from upstream API'
      })
    }

    res.status(500).json({
      error: 'Failed to fetch or process data',
      details: {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      }
    })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
  console.log(`test: curl http://localhost:${PORT}/schedule`)
})