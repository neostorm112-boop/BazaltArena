import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createMockApiRouter } from './mock-api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())
app.use('/api/mock/v1', createMockApiRouter())

const dist = path.join(__dirname, '..', 'client', 'dist')
const indexHtml = path.join(dist, 'index.html')
if (fs.existsSync(indexHtml)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(indexHtml)
  })
}

const server = app.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT}`)
  if (!fs.existsSync(indexHtml)) {
    console.log('Static: skipped (run `npm run build` in client for production assets)')
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[basalt-arena] Порт ${PORT} занят. Закройте процесс или: set PORT=3002 && node index.js`
    )
  } else {
    console.error(err)
  }
  process.exit(1)
})
