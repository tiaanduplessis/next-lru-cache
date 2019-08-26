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
