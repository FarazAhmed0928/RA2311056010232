const axios = require('axios')

// tried using fetch first but axios is easier for error handling
const BASE_URL = 'http://20.207.122.201/evaluation-service'

const getAuthHeader = (token) => {
  return { Authorization: `Bearer ${token}` }
}

// get all depots from the server
const fetchDepots = async (token) => {
  console.log("hitting depots api...")
  const res = await axios.get(`${BASE_URL}/depots`, {
    headers: getAuthHeader(token)
  })
  console.log("depots response received, count:", res.data.depots.length)
  return res.data.depots
}

// get all vehicles/tasks from the server
const fetchVehicles = async (token) => {
  console.log("hitting vehicles api...")
  const res = await axios.get(`${BASE_URL}/vehicles`, {
    headers: getAuthHeader(token)
  })
  console.log("vehicles response received, count:", res.data.vehicles.length)
  return res.data.vehicles
}

module.exports = { fetchDepots, fetchVehicles }