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
    resolve: { file: customResolver },
    dereference: {
      circular: 'ignore'
    }
  }

  return parser.dereference(schemapath, opts)
}

async function dereferenceSchemas (dir) {
  // Load all schemas from a directory
  const files = await readdir(dir)
  const promises = files.map(f => deferenceSchema(path.join(dir, f)))

  return Promise.all(promises)
}

function toTitleCase (name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

class BaseModel extends Model {}

function createModelFromSchema (schema, resolveModel) {
  const { _db: db, properties = {} } = schema
  const { name } = db
  const clsName = toTitleCase(name)
  const relationMappings = name === 'person1' ? {
    pets: {
      relation: Model.HasManyRelation,
      modelClass: () => resolveModel(toTitleCase('pet')),
      join: {
        from: 'person1.id',
        to: 'pet.owner_id'
      }
    }
  } : {}
  const relations = Object.keys(properties)
    .filter(key => properties[key]._db && properties[key]._db.fk)

  relations.forEach(key => {
    const fk = properties[key]._db.fk
    const { column, model, name: relationName } = fk
    const target = model.replace('.json', '')

    relationMappings[relationName] = {
      relation: Model.BelongsToOneRelation,
      modelClass: () => resolveModel(toTitleCase(target)),
      join: {
        from: `${name}.${key}`,
        to: `${target}.${column}`
      }
    }
  })

  if (relations.length) {
    console.log(relations)
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
  }) // [name]
}

async function test () {
  const models = {}
  function resolveModel (ref) {
    return models[ref]
  }

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

    // const resolved = await resolveSchemas(schemaDir)

    // Sort schemas
    // schemas.sort(sorter)

    const schemaModels = schemas.map(schema =>
      createModelFromSchema(schema, resolveModel))

    Object.assign(models, ...schemaModels)

    console.log(models)

    const dave = await models.Person1
      .query()
      .insert({
        first_name: 'David',
        last_name: 'Stone',
        ni: Math.random().toString(36).slice(2),
        latlng: {
          latitude: 45,
          longitude: 45
        }
      })

    const sooty = await models.Pet
      .query()
      .insert({
        name: 'Sooty',
        owner_id: dave.id,
        dob: '1996-01-01',
        description: 'Black and White like Jess the cat'
      })

    console.log(sooty instanceof models.Pet) // --> true
    console.log(sooty.name) // --> 'Jennifer'

    console.log(dave instanceof models.Person1) // --> true
    console.log(dave.first_name) // --> 'David'

    const pets = await models.Pet
      .query()
      .eager('owner')
      .orderBy('name')

    const people = await models.Person1
      .query()
      .eager('pets')

    const graph = await models.Person1
      .query()
      .insertGraph({
        first_name: 'David',
        last_name: 'Stone',
        ni: Math.random().toString(36).slice(2),
        latlng: {
          latitude: 45,
          longitude: 45
        },
        pets: [{
          name: 'Sooty1',
          dob: '1997-01-01',
          description: 'Black and White like Jess the cat1'
        }]
      })

    const gotDave = await models.Person1
      .query()
      .findById(dave.id)
      .eager('pets')

    // const dave = people[1]
    const sooty2 = await gotDave
      .$relatedQuery('pets')
      .insert({
        name: 'Sooty2',
        dob: '1997-01-01',
        description: 'Black and White like Jess the cat2'
      })

    console.log(pets, people, graph, sooty2)
  } catch (err) {
    console.error(err)
  }
}

test()

/*

Relations
---------
curr = pet
dest = person

if person HAS_MANY pet
  if pet HAS_MANY person
    ManyToMany
  else
    Add HasManyRelation to person called pets AND
    Add BelongsToOneRelation to pet call person (owner)
else
    Add HasOneRelation to person called pet AND
    Add BelongsToOneRelation to pet call person (owner)

// */
// HasManyRelation
// HasOneRelation
// BelongsToOneRelation
// ManyToManyRelation
