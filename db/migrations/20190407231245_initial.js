const path = require('path')
const { createDB } = require('@stoneware/db')
const app = require('../../app.json')
const relativeTo = path.join(__dirname, '../..')

exports.up = function (knex) {
  return createDB(app, knex, { relativeTo })
}

exports.down = function (knex) {

}
