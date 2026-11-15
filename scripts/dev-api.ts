/**
 * Local stand-in for Vercel functions: serves api/mcp.ts on port 3001.
 * The Vite dev server proxies /api here. Run with: bun run dev:api
 */
import { createServer } from 'node:http'
import mcp from '../api/mcp'

const port = Number(process.env.API_PORT ?? 3001)

createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0]
  if (path === '/api/mcp') {
    void mcp(req, res)
    return
  }
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'not found' }))
}).listen(port, () => {
  console.log(`dev api listening on http://localhost:${port}`)
})
