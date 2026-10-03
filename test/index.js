const assert = require('assert')
const http = require('http')
const express = require('express')
const entry = process.env.NEXT_LRU_CACHE_ENTRY || '..'
const nextLRUCache = require(entry)

const tests = []
function test (name, run) {
  tests.push({ name, run })
}

function fixture (options, render, setup = nextLRUCache) {
  const routes = {}
  const renders = []
  const errors = []
  const handled = []
  const app = {
    getRequestHandler: () => (req, res) => {
      handled.push(req)
      res.send('handled')
    },
    renderToHTML: async (...args) => {
      renders.push(args)
      return render ? render(...args) : `render ${renders.length}`
    },
    renderError: (...args) => errors.push(args)
  }
  setup({ get: (path, handler) => { routes[path] = handler } }, app, options)
  async function request (query = {}, path = '/', route = '*', extra = {}) {
    const req = Object.assign({ query, path }, extra)
    const res = {
      statusCode: 200,
      headers: {},
      setHeader (key, value) { this.headers[key] = value },
      send (body) { this.body = body }
    }
    await routes[route](req, res)
    return { req, res }
  }
  return { request, renders, errors, handled, routes }
}

function isolation (name, queries) {
  test(name, async () => {
    const f = fixture()
    for (let i = 0; i < queries.length; i++) {
      assert.strictEqual((await f.request(queries[i])).res.body, `render ${i + 1}`)
    }
    for (let i = 0; i < queries.length; i++) {
      assert.strictEqual((await f.request(queries[i])).res.body, `render ${i + 1}`)
    }
    assert.strictEqual(f.renders.length, queries.length)
  })
}

isolation('different query values have isolated cache entries', [{ page: '1' }, { page: '2' }])
isolation('nested values have isolated cache entries', [{ filter: { name: 'a' } }, { filter: { name: 'b' } }])
isolation('array order is significant', [{ tag: ['a', 'b'] }, { tag: ['b', 'a'] }])
isolation('array values are isolated', [{ tag: ['a', 'b'] }, { tag: ['a', 'c'] }])
isolation('scalar, array and numeric-key object are distinct', [{ a: 'x' }, { a: ['x'] }, { a: { 0: 'x' } }])
isolation('empty values and containers are distinct', [{}, { a: '' }, { a: [] }, { a: {} }])
isolation('nested arrays of objects retain their values', [{ a: [{ x: '1' }] }, { a: [{ x: '2' }] }])
isolation('JSON punctuation and Unicode cannot alias query structures', [
  { a: 'x","b":"y' }, { a: 'x', b: 'y' }, { a: '[]{}:,\\"☃' }
])
isolation('special object property names remain data', [
  JSON.parse('{"__proto__":{"x":"1"}}'),
  JSON.parse('{"__proto__":{"x":"2"}}'),
  { constructor: 'a' }, { toString: 'a' }, { toJSON: 'a' }
])

test('reordered object keys share a cache entry without mutating queries', async () => {
  const one = Object.freeze({ z: '1', a: Object.freeze({ y: '2', x: '3' }) })
  const two = Object.freeze({ a: Object.freeze({ x: '3', y: '2' }), z: '1' })
  const f = fixture()
  const first = await f.request(one)
  const second = await f.request(two)
  assert.strictEqual(second.res.body, first.res.body)
  assert.strictEqual(f.renders.length, 1)
  assert.strictEqual(f.renders[0][3], one)
  assert.deepStrictEqual(Object.keys(one), ['z', 'a'])
  assert.deepStrictEqual(Object.keys(one.a), ['y', 'x'])
})

test('reordered keys inside array elements share a cache entry', async () => {
  const f = fixture()
  await f.request({ a: [{ z: '1', x: '2' }] })
  await f.request({ a: [{ x: '2', z: '1' }] })
  assert.strictEqual(f.renders.length, 1)
})

test('null-prototype parsed queries share the same semantic key', async () => {
  const f = fixture()
  const query = Object.create(null)
  query.a = Object.assign(Object.create(null), { x: '1' })
  await f.request(query)
  await f.request({ a: { x: '1' } })
  assert.strictEqual(f.renders.length, 1)
})

test('request paths remain isolated and reach the Next renderer unchanged', async () => {
  const f = fixture()
  await f.request({ q: 'x' }, '/a')
  await f.request({ q: 'x' }, '/b')
  assert.strictEqual(f.renders.length, 2)
  assert.strictEqual(f.renders[0][2], '/a')
  assert.strictEqual(f.renders[1][2], '/b')
})

test('path and query boundaries are unambiguous', async () => {
  const f = fixture()
  await f.request({ q: 'x-y' }, '/a')
  await f.request({ q: 'y' }, '/a-x')
  assert.strictEqual(f.renders.length, 2)
})

test('custom getCacheKey receives each original request and controls identity', async () => {
  const requests = []
  const f = fixture({
    getCacheKey: req => {
      requests.push(req)
      return req.headers.tenant
    }
  })
  const a = await f.request({ page: '1' }, '/', '*', { headers: { tenant: 'a' } })
  const b = await f.request({ page: '2' }, '/', '*', { headers: { tenant: 'a' } })
  const c = await f.request({ page: '1' }, '/', '*', { headers: { tenant: 'b' } })
  assert.strictEqual(a.res.body, b.res.body)
  assert.notStrictEqual(a.res.body, c.res.body)
  assert.strictEqual(f.renders.length, 2)
  assert.deepStrictEqual(requests, [a.req, b.req, c.req])
})

test('separate middleware instances do not share cache entries', async () => {
  const a = fixture(undefined, () => 'a')
  const b = fixture(undefined, () => 'b')
  assert.strictEqual((await a.request()).res.body, 'a')
  assert.strictEqual((await b.request()).res.body, 'b')
})

test('Next and static assets bypass the cache', async () => {
  const f = fixture({ getCacheKey: () => { throw new Error('must bypass') } })
  assert.deepStrictEqual(Object.keys(f.routes), ['/_next/*', '/static/*', '*'])
  for (const route of ['/_next/*', '/static/*']) {
    const result = await f.request({}, route, route)
    assert.strictEqual(result.res.body, 'handled')
  }
  assert.strictEqual(f.handled.length, 2)
  assert.strictEqual(f.renders.length, 0)
})

test('non-200 responses are sent without being cached', async () => {
  const f = fixture(undefined, (req, res) => {
    res.statusCode = 404
    return 'missing'
  })
  for (let i = 0; i < 2; i++) {
    const { res } = await f.request()
    assert.strictEqual(res.body, 'missing')
    assert.strictEqual(res.statusCode, 404)
    assert.deepStrictEqual(res.headers, {})
  }
  assert.strictEqual(f.renders.length, 2)
})

test('render failures reach renderError and are not cached', async () => {
  const error = new Error('render failed')
  const f = fixture(undefined, () => { throw error })
  for (let i = 0; i < 2; i++) {
    const { req, res } = await f.request({ a: '1' }, '/error')
    assert.deepStrictEqual(f.errors[i], [error, req, res, '/error', req.query])
    assert.strictEqual(res.body, undefined)
  }
  assert.strictEqual(f.renders.length, 2)
})

test('max and length configure weighted LRU eviction', async () => {
  let measured = 0
  const f = fixture({ max: 1, length: html => { measured++; return 1 } })
  await f.request({}, '/a')
  await f.request({}, '/b')
  await f.request({}, '/a')
  assert.strictEqual(f.renders.length, 3)
  assert.strictEqual(measured, 3)
})

test('maxAge expires entries without refreshing on reads', async () => {
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    const f = fixture({ maxAge: 100 })
    await f.request()
    now += 99
    await f.request()
    assert.strictEqual(f.renders.length, 1)
    now += 2
    await f.request()
    assert.strictEqual(f.renders.length, 2)
  } finally {
    Date.now = originalNow
  }
})

test('maxAge zero disables expiry while oversized entries are not cached', async () => {
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    const f = fixture({ maxAge: 0 })
    await f.request()
    now += 1000 * 60 * 60 * 24 * 60
    await f.request()
    assert.strictEqual(f.renders.length, 1)

    const oversized = fixture({ max: 1 })
    await oversized.request()
    await oversized.request()
    assert.strictEqual(oversized.renders.length, 2)
  } finally {
    Date.now = originalNow
  }
})

test('cache headers appear only outside production', async () => {
  const previous = process.env.NODE_ENV
  const resolved = require.resolve(entry)
  try {
    for (const mode of ['development', 'production']) {
      process.env.NODE_ENV = mode
      delete require.cache[resolved]
      const f = fixture(undefined, undefined, require(entry))
      const miss = await f.request()
      const hit = await f.request()
      assert.strictEqual(miss.res.headers['X-LRU-Cache'], mode === 'production' ? undefined : 'false')
      assert.strictEqual(hit.res.headers['X-LRU-Cache'], mode === 'production' ? undefined : 'true')
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
    delete require.cache[resolved]
  }
})

function get (server, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ body, statusCode: res.statusCode }))
      res.on('error', reject)
    }).on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error(`Request timed out: ${path}`)))
  })
}

test('real Express 4 requests preserve parsed query semantics and bypass routes', async () => {
  const server = express()
  let renders = 0
  nextLRUCache(server, {
    getRequestHandler: () => (req, res) => res.send('asset'),
    renderToHTML: async (req, res, path, query) => JSON.stringify({ render: ++renders, path, query }),
    renderError: (error, req, res) => res.status(500).send(error.message)
  })
  const listener = await new Promise((resolve, reject) => {
    const listener = server.listen(0, '127.0.0.1', () => resolve(listener))
    listener.on('error', reject)
  })
  try {
    const one = await get(listener, '/page?a=1&filter[x]=y&tag[]=a&tag[]=b')
    const equivalent = await get(listener, '/page?tag[]=a&tag[]=b&filter[x]=y&a=1')
    const different = await get(listener, '/page?a=2&filter[x]=y&tag[]=a&tag[]=b')
    const reorderedArray = await get(listener, '/page?a=1&filter[x]=y&tag[]=b&tag[]=a')
    assert.strictEqual(one.statusCode, 200)
    assert.strictEqual(one.body, equivalent.body)
    assert.notStrictEqual(one.body, different.body)
    assert.notStrictEqual(one.body, reorderedArray.body)
    assert.deepStrictEqual(JSON.parse(one.body).query, { a: '1', filter: { x: 'y' }, tag: ['a', 'b'] })
    assert.strictEqual((await get(listener, '/_next/chunk.js')).body, 'asset')
    assert.strictEqual((await get(listener, '/static/logo.svg')).body, 'asset')
    assert.strictEqual(renders, 3)
  } finally {
    await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  }
})

async function run () {
  let failures = 0
  for (const { name, run } of tests) {
    try {
      await run()
      console.log(`ok - ${name}`)
    } catch (error) {
      failures++
      console.error(`not ok - ${name}\n${error.stack}`)
    }
  }
  console.log(`${tests.length - failures}/${tests.length} tests passed`)
  if (failures) process.exitCode = 1
}
run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
