
# next-lru-cache
[![package version](https://img.shields.io/npm/v/next-lru-cache.svg?style=flat-square)](https://npmjs.org/package/next-lru-cache)
[![package downloads](https://img.shields.io/npm/dm/next-lru-cache.svg?style=flat-square)](https://npmjs.org/package/next-lru-cache)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/next-lru-cache.svg?style=flat-square)](https://npmjs.org/package/next-lru-cache)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

> Little LRU cache for Next.js

## Table of Contents

- [About](#about)
- [Usage](#usage)
- [Options](#options)
- [Install](#install)
- [Contribute](#contribute)
- [License](#License)

## About

Based on [this article](https://medium.com/@igordata/how-to-cache-all-pages-in-next-js-at-server-side-1850aace87dc) by Igor Data.

## Usage

```js
const express = require('express')
const next = require('next')

const nextLRUCache = require('next-lru-cache')

const app = next({ dev: process.env.NODE_ENV !== 'production' })

app
  .prepare()
  .then(() => {
    const server = express()

    nextLRUCache(server, app)

    server.listen(3000, err => {
      if (err) {
        throw err
      }
      console.log('> Running on port 3000')
    })
  })
  .catch(error => {
    console.error(error.stack)
    process.exit(1)
  })

```


## Options

Pass an optional third argument to `nextLRUCache(server, app, options)`:

```js
nextLRUCache(server, app, {
  max: 100 * 1024 * 1024,
  length: html => html.length,
  maxAge: 1000 * 60 * 60 * 24 * 30
})
```

- `max` (number, default `100 * 1024 * 1024`): maximum total cache weight. When
  adding an entry would exceed this limit, the least recently used entries are
  evicted. An entry larger than the limit is not cached.
- `length` (function, default `html => html.length`): calculates an entry's
  weight. The default measures JavaScript string length, not bytes of memory.
  For an entry-count limit, use `length: () => 1` with the desired `max`.
- `maxAge` (number, default `1000 * 60 * 60 * 24 * 30`): maximum entry age in
  milliseconds (30 days by default). Reads do not reset the age. Set to `0` to
  disable age-based expiry; the size limit still applies.
- `getCacheKey` (function): receives the Express request and returns the cache
  key. By default, the key is a JSON-encoded tuple of `req.path` and `req.query`,
  with object keys sorted recursively. Equivalent parsed queries share an entry
  regardless of object-key order; different values, array order, nested
  structures, or paths have separate entries. Query strings use Express's
  configured parser. Custom parsers returning values other than strings, arrays,
  and plain objects should supply a matching `getCacheKey`.

The cache is local to each `nextLRUCache` call. Only successful (`200`) HTML
responses are stored. `/_next/*` and `/static/*` requests bypass the cache and go
to Next's request handler; render errors go to `app.renderError`. Outside
production, HTML cache misses and hits include `X-LRU-Cache: false` and
`X-LRU-Cache: true`, respectively.

The default key does not include cookies, headers, host, or user identity. Only
use it for pages whose HTML depends solely on the path and parsed query. Handle
private or personalized routes before registering this middleware, or supply a
custom key that includes every value that changes the rendered HTML. For
example, if trusted middleware sets `req.locale`, a locale-aware key could be:

```js
nextLRUCache(server, app, {
  getCacheKey: req => JSON.stringify([req.locale, req.originalUrl])
})
```

A custom key replaces the default completely. In this example the original URL
retains query-string ordering, so reordered query strings can have separate
entries.

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com).

It requires [Express 4](https://expressjs.com/) and [Next.js 8 or 9](https://nextjs.org/)
as peer dependencies. This package uses Next's custom-server `renderToHTML` API.

```sh
$ npm install next-lru-cache
$ # OR
$ yarn add next-lru-cache
```

## Contribute

Install development dependencies with Yarn, then run `yarn test` and `yarn lint`.
The tests use Node's built-in assertions and a real Express 4 server with a
small Next custom-server API fixture. They do not build or run a Next application.
The development linter requires Node 12.22, 14.17, or 16 and later; use a maintained
Node release for development. This tooling requirement does not change the
package's runtime API or peer ranges.

1. Fork it and create your feature branch: `git checkout -b my-new-feature`
2. Commit your changes: `git commit -am "Add some feature"`
3. Push to the branch: `git push origin my-new-feature`
4. Submit a pull request

## License

MIT
