const LRUCache = require('lru-cache')

const dev = process.env.NODE_ENV !== 'production'

module.exports = function nextLRUCache (
  server,
  app,
  {
    max = 100 * 1024 * 1024,
    length = n => n.length,
    maxAge = 1000 * 60 * 60 * 24 * 30,
    getCacheKey = req => `${req.path}-${req.query}`
  } = {}
) {
  const handle = app.getRequestHandler()

  const ssrCache = new LRUCache({
    max,
    length,
    maxAge
  })

  server.get('/_next/*', (req, res) => {
    handle(req, res)
  })

  server.get('/static/*', (req, res) => {
    handle(req, res)
  })

  server.get('*', (req, res) => renderAndCache(req, res))

  async function renderAndCache (req, res) {
    const key = getCacheKey(req)

    if (ssrCache.has(key)) {
      if (dev) {
        res.setHeader('x-lru-cache', 'true')
      }

      res.send(ssrCache.get(key))
      return
    }

    try {
      const html = await app.renderToHTML(req, res, req.path, req.query)

      if (res.statusCode !== 200) {
        res.send(html)
        return
      }

      ssrCache.set(key, html)

      if (dev) {
        res.setHeader('x-lru-cache', 'false')
      }

      res.send(html)
    } catch (err) {
      app.renderError(err, req, res, req.path, req.query)
    }
  }
}
