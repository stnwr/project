import fs from 'fs'
import path from 'path'
import Knex from 'knex'
import { Model } from 'objection'
import parser from 'json-schema-ref-parser'

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

class BaseModel extends Model {}

function toTitleCase (name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function createModelFromSchema (schema, relations, resolveModel) {
  const { _db: db, properties = {} } = schema
  const { name } = db
  const clsName = toTitleCase(name)
  const relationMappings = {}

  const modelRelations = relations
    .filter(relation => relation.join.from.startsWith(`${name}.`))

  modelRelations.forEach(relation => {
    // const fk = properties[key]._db.fk
    const { join, modelClass, name, onDelete } = relation
    // const target = model.replace('.json', '')

    relationMappings[name] = {
      relation: Model[`${relation.type}Relation`],
      modelClass: () => resolveModel(modelClass),
      join: join
    }
  })

  if (modelRelations.length) {
    console.log(modelRelations)
  }

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
  })
}

export async function createModels (dir) {
  // Read & deference schema
  // Load all schemas from a directory
  const files = await readdir(dir)
  const opts = { dereference: { circular: 'ignore' } }
  const promises = files.map(f =>
    parser.dereference(path.join(dir, f), opts))

  const schemas = await Promise.all(promises)

  // Read the entity relations
  const relations = require(path.join(dir, '..', 'relations.json'))

  const models = {}
  function resolveModel (ref) {
    return models[ref]
  }

  // Build the Objection ORM models from the schema/relations
  const schemaModels = schemas.map(schema =>
    createModelFromSchema(schema, relations, resolveModel))

  Object.assign(models, ...schemaModels)

  return schemaModels
}

async function test () {
  const models = await createModels(path.join(__dirname, 'schema/db'))

  console.log(models)
  return models
}

test()
