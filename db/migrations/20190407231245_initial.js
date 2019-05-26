const path = require('path')
const { createDB1 } = require('@stoneware/db')
// const app = require('../../app.json')
const app = require('../../../ui/src/data.json')
const relativeTo = path.join(__dirname, '../..')

exports.up = function (knex) {
  return createDB1(app, knex, { relativeTo })
}

exports.down = function (knex) {

}
