// knapsack approach - greedy wont work here since we need optimal
// dp is the way to go for this kind of problem

// step 1 - build the dp table
const buildDPTable = (vehicles, capacity) => {
  const n = vehicles.length
  console.log(`building dp table: ${n} vehicles x ${capacity} capacity`)

  // initialize 2d array with zeros
  const dp = []
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(capacity + 1).fill(0)
  }

  console.log("dp table initialized, filling now...")

  for (let i = 1; i <= n; i++) {
    const dur = vehicles[i - 1].Duration
    const imp = vehicles[i - 1].Impact

    for (let w = 0; w <= capacity; w++) {
      // option 1 - skip this vehicle
      dp[i][w] = dp[i - 1][w]

      // option 2 - pick this vehicle if it fits
      if (dur <= w) {
        const withThis = dp[i - 1][w - dur] + imp
        if (withThis > dp[i][w]) {
          dp[i][w] = withThis
        }
      }
    }
  }

  console.log("dp table filled, max impact:", dp[n][capacity])
  return dp
}

// step 2 - backtrack to find which tasks were actually picked
const getSelectedTasks = (dp, vehicles, capacity) => {
  const n = vehicles.length
  let w = capacity
  const selected = []

  console.log("backtracking to find selected tasks...")

  for (let i = n; i >= 1; i--) {
    // if value changed from previous row, this task was included
    if (dp[i][w] !== dp[i - 1][w]) {
      const task = vehicles[i - 1]
      selected.push(task)
      w -= task.Duration
      console.log(`task picked: ${task.TaskID} | dur: ${task.Duration} | impact: ${task.Impact} | remaining capacity: ${w}`)
    }
  }

  console.log("backtrack complete, total tasks selected:", selected.length)
  return selected
}

// step 3 - calculate total duration used
const getTotalDuration = (tasks) => {
  const total = tasks.reduce((sum, t) => sum + t.Duration, 0)
  console.log("total duration used:", total)
  return total
}

// main entry point - called from server.js for each depot
const runScheduler = (vehicles, capacity) => {
  console.log(`\nrunning scheduler | capacity: ${capacity} hours | vehicles: ${vehicles.length}`)

  const dp = buildDPTable(vehicles, capacity)
  const maxImpact = dp[vehicles.length][capacity]
  const selectedTasks = getSelectedTasks(dp, vehicles, capacity)
  const totalDuration = getTotalDuration(selectedTasks)

  console.log(`scheduler result -> impact: ${maxImpact} | duration: ${totalDuration}/${capacity}`)

  return { maxImpact, selectedTasks, totalDuration }
}

module.exports = { runScheduler }