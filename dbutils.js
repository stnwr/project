import path from 'path'
import assert from 'assert'
import { Model, snakeCaseMappers } from 'objection'
import parser from 'json-schema-ref-parser'
import { toTitleCase } from './helpers'

function columnRelations (db, table, columnName) {
  return tableRelations(db, table)
    .filter(relation => tableRelationTarget(relation).from.column === columnName)
}

function tableRelationTarget (relation) {
  return relation.type === 'BelongsToOne'
    ? relation.join
    : relation.join.through
}

function tableRelations (db, table) {
  const fkTypes = ['BelongsToOne', 'ManyToMany']

  return db.relations
    .filter(relation =>
      fkTypes.includes(relation.type) &&
      tableRelationTarget(relation).from.table === table.name)
}

function resolveJoin (join, resolveModel) {
  const result = {
    to: `${join.to.table}.${join.to.column}`,
    from: `${join.from.table}.${join.from.column}`
  }

  if (join.through) {
    result.through = {
      to: `${join.through.to.table}.${join.through.to.column}`,
      from: `${join.through.from.table}.${join.through.from.column}`,
      extra: join.through.extra,
      modelClass: resolveModel(join.through.modelClass)
    }
  }

  return result
}

function createModelFromSchema (schema, table, relations, resolveModel, BaseModel) {
  const { properties = {} } = schema
  const name = table.name
  const clsName = toTitleCase(name)
  const relationMappings = {}

  const modelRelations = relations
    .filter(relation => relation.join.from.table === name)

  modelRelations.forEach(relation => {
    const { join, modelClass, name, onDelete } = relation

    relationMappings[name] = {
      relation: Model[`${relation.type}Relation`],
      modelClass: () => resolveModel(modelClass),
      join: resolveJoin(join, resolveModel)
    }
  })

  return ({
    [clsName]: class extends BaseModel {
      static get tableName () {
        return name
      }

      // static get columnNameMappers () {
      //   return snakeCaseMappers()
      // }

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

function createColumnFromProperty (db, def, table, key, schema, knex) {
  const { properties, required = [] } = schema
  let property = properties[key]
  let nullable = !required.includes(key)

  if (Array.isArray(property.type)) {
    const types = property.type
    assert.strictEqual(types.length, 2)
    const notNullTypes = types.filter(type => type !== 'null')
    assert.strictEqual(notNullTypes.length, 1)
    property.type = notNullTypes[0]
    nullable = true
  }

  const { type } = property
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
    if (property.minimum >= 0) {
      chain = chain.unsigned()
    }
  }

  if (property.description) {
    chain = chain.comment(property.description)
  }

  const relations = columnRelations(db, def, key)

  if (relations.length) {
    assert.strictEqual(relations.length, 1)
    const relation = relations[0]

    if (relation.type === 'BelongsToOne') {
      const join = relation.join

      chain
        .unsigned()
        .references(join.to.column)
        .inTable(join.to.table)
        .onDelete(relation.onDelete)
    } else {
      const join = relation.join

      chain
        .unsigned()
        .references(join.from.column)
        .inTable(join.from.table)
        .onDelete(relation.onDelete)
    }
  }

  console.log(chain)
}

function factorySorter (db) {
  return function sorter (a, b) {
    const aRefs = tableRelations(db, a)
      .map(relation => relation.join.to.table)

    const bRefs = tableRelations(db, b)
      .map(relation => relation.join.to.table)

    const aRefsB = aRefs.includes(b.name)
    const bRefsA = bRefs.includes(a.name)

    if (aRefsB && bRefsA) {
      throw new Error('TODO: Deal with circular refs')
    } else if (aRefsB) {
      return 1
    } else if (bRefsA) {
      return -1
    }

    return 0
  }
}

function createTableFactory ({ db, def, schema }) {
  return function (knex) {
    const { properties } = schema
    return knex.schema.createTable(def.name, function (table) {
      // Include default id column
      table.increments('id').unsigned().primary()

      // Add columns from properties
      Object.keys(properties)
        .filter(key => key !== 'id')
        .forEach(key => createColumnFromProperty(db, def, table, key, schema, knex))

      // Include default timestamp columns (created_at, updated_at)
      table.timestamps(true, true)

      // Indexes
      if (Array.isArray(def.indexes)) {
        def.indexes.forEach(index => {
          table[index.unique ? 'unique' : 'index'](index.columns)
        })
      }
    })
  }
}

export async function createModels (db, knex, { relativeTo = 'schema/db' } = {}) {
  const tables = db.tables
  const files = tables.map(table => path.join(__dirname, relativeTo, table.schema))
  const opts = { dereference: { circular: 'ignore' } }
  const promises = files.map(file => parser.dereference(file, opts))
  const schemas = await Promise.all(promises)

  class BaseModel extends Model {}

  // Give the knex object to objection.
  BaseModel.knex(knex)

  // Read the entity relations
  const relations = db.relations

  const models = {}
  function resolveModel (ref) {
    return models[ref]
  }

  // Build the Objection ORM models from the schema/relations
  const schemaModels = schemas.map((schema, idx) =>
    createModelFromSchema(schema, tables[idx], relations, resolveModel, BaseModel))

  Object.assign(models, ...schemaModels)

  return models
}

export async function createDB (db, knex, { relativeTo = 'schema/db' } = {}) {
  try {
    const sorter = factorySorter(db)
    const tables = db.tables.slice().sort(sorter)
    const files = tables.map(table => path.join(__dirname, relativeTo, table.schema))
    const opts = { dereference: { circular: 'ignore' } }
    const promises = files.map(file => parser.dereference(file, opts))
    const schemas = await Promise.all(promises)
    console.log('schemas', schemas)

    // Process schema
    let idx = 0
    for (const schema of schemas) {
      const def = tables[idx]
      const factory = createTableFactory({ db, def, schema })
      const result = await factory(knex)
      console.log(def.name, result)
      idx++
    }

    // return schemas
  } catch (err) {
    throw err
    console.error(err)
  }
}
