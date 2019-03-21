import fs from 'fs'
import assert from 'assert'
import path from 'path'
import Knex from 'knex'

export function createTableFromSchema ({ schema, refs, path, paths }) {
  return function (knex) {
    const { _db, properties } = schema
    return knex.schema.createTable(_db.name, function (table) {
      // Include default id column
      table.increments('id').unsigned().primary()

      // Add columns from properties
      Object.keys(properties)
        .filter(key => key !== 'id')
        .forEach(key => createColumnFromProperty(table, key, schema, refs))

      // Include default timestamp columns (created_at, updated_at)
      table.timestamps(true, true)

      // Indexes
      if (Array.isArray(_db.indexes)) {
        _db.indexes.forEach(index => {
          table[index.unique ? 'unique' : 'index'](index.columns)
        })
      }
    })
  }
}

export function createColumnFromProperty (table, key, schema, refs) {
  const { properties, required = [] } = schema
  let property = properties[key]
  let nullable = !required.includes(key)
  // const { $ref } = property

  // if ($ref) {
  //   // Property has a $ref
  //   const ref = refs.get($ref)
  //   // const defsPrefix = '#/definitions/'
  //   // $ref.startsWith(defsPrefix)
  //   const isDBModel = $ref.startsWith('./')
  //   if (isDBModel) {
  //     // Relative (model) reference
  //     const resolvedRef = refs.get($ref)

  //     property = {
  //       type: 'integer',
  //       _db: {
  //         unsigned: true,
  //         fk: { table: resolvedRef._db.name, column: 'id', onDelete: 'CASCADE' }
  //       }
  //     }
  //   } else {
  //     // File (definitions) reference
  //     property = ref
  //   }
  // }

  if (Array.isArray(property.type)) {
    const types = property.type
    assert.strictEqual(types.length, 2)
    const notNullTypes = types.filter(type => type !== 'null')
    assert.strictEqual(notNullTypes.length, 1)
    property.type = notNullTypes[0]
    nullable = true
  }

  const { _db = {}, type } = property
  const [dbType, ...rest] = getKnexTypeArgsFromProperty(property)

  let chain = table[dbType](key, ...rest)[nullable ? 'nullable' : 'notNullable']()

  if (property.default) {
    chain = chain.defaultTo(property.default === 'now'
      ? knex.fn.now()
      : property.default)
  }

  if (type === 'string') {

  } else if (type === 'number') {

  } else if (type === 'integer') {
    if (_db.unsigned) {
      chain = chain.unsigned()
    }
  }

  if (property.description) {
    chain = chain.comment(property.description)
  }

  if (_db.fk) {
    chain
      .unsigned()
      .references(_db.fk.column)
      .inTable(_db.fk.model.replace('.json', ''))
      .onDelete(_db.fk.onDelete)
  }

  console.log(chain)
}

function getKnexTypeArgsFromProperty (property) {
  const { type, format, enum: enumerable, _db = {} } = property

  const timeFormatters = ['date-time', 'date', 'time']

  switch (type) {
    case 'string':
      if (timeFormatters.includes(format)) {
        return [format.replace('-', '')]
      } else if (Array.isArray(enumerable)) {
        return ['enum', enumerable]
      } else {
        return _db['text'] || property.maxLength > 255
          ? ['text', property.maxLength]
          : ['string', property.maxLength]
      }
    case 'integer':
    case 'boolean':
      return [type]
    case 'number': {
      return ['float']
    }
    case 'object':
    case 'array': {
      return ['json']
    }
    default: {
      throw new Error(`Unsupported type "${type}"`)
    }
  }
}

const parser = require('json-schema-ref-parser')

// TEST
const knex = Knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'Babble01',
    database: 'stoneware'
  }
})

async function processSchema (schema) {
  try {
    const factory = createTableFromSchema(schema)
    const res = await factory(knex)
    console.log(res)
    return res
  } catch (err) {
    console.error(err)
  }
}

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
  return parser.dereference(schemapath)
}

async function dereferenceSchemas (dir) {
  // Load all schemas from a directory
  const files = await readdir(dir)
  const promises = files.map(file => {
    const fullpath = path.join(dir, file)
    return parser.dereference(fullpath).then(schema => {
      return { file, schema }
    })
  })

  return Promise.all(promises)
}

function sorter (a, b) {
  const aRefsB = a.refs.exists(b.path)
  const bRefsA = b.refs.exists(a.path)

  if (aRefsB && bRefsA) {
    throw new Error('TODO: Deal with circular refs')
  } else if (aRefsB) {
    return 1
  } else if (bRefsA) {
    return -1
  }

  return 0
}

function schemaRelations (schema) {
  const relations = []

  Object.keys(schema.properties).forEach(key => {
    const property = schema.properties[key]

    if (property.type === 'integer') {
      if (property._db) {
        if (property._db.fk) {
          relations.push(property._db.fk.model)
        }
      }
    }
  })

  return relations
}

function sorter1 (a, b) {
  const aRefs = schemaRelations(a.schema)
  const bRefs = schemaRelations(b.schema)
  const aRefsB = aRefs.includes(b.file)
  const bRefsA = bRefs.includes(a.file)

  if (aRefsB && bRefsA) {
    throw new Error('TODO: Deal with circular refs')
  } else if (aRefsB) {
    return 1
  } else if (bRefsA) {
    return -1
  }

  return 0
}

async function test () {
  try {
    const schemadir = path.join(__dirname, 'schema/db')
    // const schemas = await resolveSchemas(schemadir)

    const schemas = await dereferenceSchemas(schemadir)

    // Sort schemas
    schemas.sort(sorter1)

    // Process schema
    // const processors = schemas.map(processSchema)
    // const result = await Promise.all(processors)

    for (const schema of schemas) {
      const result = await processSchema(schema)
      console.log(result)
    }

    // console.log(result)
  } catch (err) {
    console.error(err)
  }
}

test()
