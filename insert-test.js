import fs from 'fs'
import path from 'path'
import Knex from 'knex'
import { Model } from 'objection'
import parser from 'json-schema-ref-parser'
import fileResolver from 'json-schema-ref-parser/lib/resolvers/file'

async function readdir (dir) {
  // Load all schemas from a directory
  return new Promise((resolve, reject) => {
    fs.readdir(dir, function (err, items) {
      if (err) {
        reject(err)
        return
      }
      resolve(items)
    })
  })
}

async function resolveSchema (path) {
  return parser.resolve(path)
    .then(refs => {
      const paths = refs.paths()
      const schema = refs.get(path)

      return { schema, refs, path, paths }
    })
}

async function resolveSchemas (dir) {
  // Load all schemas from a directory
  const files = await readdir(dir)
  const promises = files
    .map(f => resolveSchema(path.join(dir, f)))

  return Promise.all(promises)
}

async function deferenceSchema (schemapath) {
  async function read (file) {
    const isDBSchemaRef = file.url !== schemapath &&
      path.dirname(file.url) === '/Users/dstone/Documents/dev/stoneware/db/schema/db'

    if (isDBSchemaRef) {
      // We don't want to deference sibling
      // schema but turn them into an fk integer
      const ref = (await fileResolver.read(file)).toString()

      return {
        type: 'integer',
        minimum: 1,
        _db: {
          fk: {
            relation: Model.BelongsToOneRelation,
            // modelClass: Pet,
            join: {
              from: 'persons.pet',
              to: 'pet.id'
            }
          }
        }
      }
    } else {
      return fileResolver.read(file)
    }
  }

  const customResolver = Object.assign({}, fileResolver, { read })

  const opts = {
    resolve: { file: customResolver }
  }

  return parser.dereference(schemapath, opts)
}

async function dereferenceSchemas (dir) {
  // Load all schemas from a directory
  const files = await readdir(dir)
  const promises = files.map(f => deferenceSchema(path.join(dir, f)))

  return Promise.all(promises)
}

class BaseModel extends Model {}

function createModelFromSchema (schema) {
  const { _db: db } = schema
  const { name } = db
  const clsName = name.charAt(0).toUpperCase() + name.slice(1)
  const relationMappings = {}

  return ({
    [clsName]: class extends BaseModel {
      static get tableName () {
        return name
      }

      static get idColumn () {
        return 'id'
      }

      static get jsonSchema () {
        return schema
      }

      static get relationMappings () {
        return relationMappings
      }
    }
  }) // [name]
}

async function test () {
  try {
    const knex = Knex({
      client: 'mysql2',
      connection: {
        host: '127.0.0.1',
        user: 'root',
        password: 'Babble01',
        database: 'stoneware'
      }
    })

    Model.knex(knex)

    // await processSchema('pet.json')
    // await processSchema('person.json')
    const schemaDir = path.join(__dirname, 'schema/db')
    const schemas = await dereferenceSchemas(schemaDir)

    const resolved = await resolveSchemas(schemaDir)

    // Sort schemas
    // schemas.sort(sorter)

    const schemaModels = schemas.map(createModelFromSchema)

    const models = {}
    Object.assign(models, ...schemaModels)

    console.log(models)

    const sooty = await models.Pet
      .query()
      .insert({
        name: 'Sooty',
        dob: '1996-01-01',
        description: 'Black and White like Jess the cat'
      })

    const dave = await models.Person1
      .query()
      .insert({
        first_name: 'David',
        last_name: 'Stone',
        pet: sooty.id,
        ni: 'JC12345 A',
        latlng: {
          latitude: 45,
          longitude: 45
        }
      })

    console.log(sooty instanceof models.Pet) // --> true
    console.log(sooty.name) // --> 'Jennifer'

    console.log(dave instanceof models.Person1) // --> true
    console.log(dave.first_name) // --> 'David'
  } catch (err) {
    console.error(err)
  }
}

test()
