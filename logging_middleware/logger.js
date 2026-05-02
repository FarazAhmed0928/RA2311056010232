const logger = (req, res, next) => {
  const start = Date.now()
  const timestamp = new Date().toISOString()

  console.log(`[${timestamp}] --> ${req.method} ${req.url}`)
  console.log(`headers: ${JSON.stringify(req.headers)}`)

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[${timestamp}] <-- ${req.method} ${req.url} | status: ${res.statusCode} | duration: ${duration}ms`)
  })

  next()
}

module.exports = logger