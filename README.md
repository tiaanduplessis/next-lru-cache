
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
- [Install](#install)
- [Contribute](#contribute)
- [License](#License)

## About

Based on [this article](How to cache all pages in Next.js at server side) by Igor Data.

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


## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com).

```sh
$ npm install next-lru-cache
$ # OR
$ yarn add next-lru-cache
```

## Contribute

1. Fork it and create your feature branch: `git checkout -b my-new-feature`
2. Commit your changes: `git commit -am "Add some feature"`
3. Push to the branch: `git push origin my-new-feature`
4. Submit a pull request

## License

MIT
