// run the following command to install:
// npm install objection knex sqlite3

const Knex = require('knex')
const { Model } = require('objection')

// Initialize knex.
const knex = Knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'Babble01',
    database: 'stoneware'
  }
})

// Give the knex object to objection.
Model.knex(knex)

// Person model.
class Person extends Model {
  // Table name is the only required property.
  static get tableName () {
    return 'persons'
  }

  // Each model must have a column (or a set of columns) that uniquely
  // identifies the rows. The column(s) can be specified using the `idColumn`
  // property. `idColumn` returns `id` by default and doesn't need to be
  // specified unless the model's primary key is something else.
  static get idColumn () {
    return 'id'
  }

  // Methods can be defined for model classes just as you would for
  // any javascript class. If you want to include the result of these
  // method in the output json, see `virtualAttributes`.
  fullName () {
    return this.firstName + ' ' + this.lastName
  }

  // Optional JSON schema. This is not the database schema!
  // Nothing is generated based on this. This is only used
  // for input validation. Whenever a model instance is created
  // either explicitly or implicitly it is checked against this schema.
  // http://json-schema.org/.
  static get jsonSchema () {
    return {
      type: 'object',
      required: ['firstName', 'lastName'],

      properties: {
        id: { type: 'integer' },
        parentId: { type: ['integer', 'null'] },
        firstName: { type: 'string', minLength: 1, maxLength: 255 },
        lastName: { type: 'string', minLength: 1, maxLength: 255 },
        age: { type: 'number' },

        // Properties defined as objects or arrays are
        // automatically converted to JSON strings when
        // writing to database and back to objects and arrays
        // when reading from database. To override this
        // behaviour, you can override the
        // Person.jsonAttributes property.
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string' }
          }
        }
      }
    }
  }
}

class Type extends Model {
  static get tableName () {
    return 'types'
  }
}

// Create database schema. You should use knex migration files to do this.
// We create it here for simplicity.
async function createSchema () {
  const hasTable = await knex.schema.hasTable('persons')
  if (!hasTable) {
    return knex.schema.createTable('persons', (table) => {
      table.increments('id').primary()
      table.integer('parentId').references('persons.id')
      table.string('firstName')
    })
  }
}

async function main () {
  // Create some people.
  const sylvester = await Person.query().insertGraph({
    firstName: 'Sylvester',

    children: [
      {
        firstName: 'Sage'
      },
      {
        firstName: 'Sophia'
      }
    ]
  })

  console.log('created:', sylvester)

  // Fetch all people named Sylvester and sort them by id.
  // Load `children` relation eagerly.
  const sylvesters = await Person.query()
    .where('firstName', 'Sylvester')
    .eager('children')
    .orderBy('id')

  console.log('sylvesters:', sylvesters)
}

createSchema().then(() => main()).catch(console.error)
