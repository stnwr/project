// const jsonSchema = {
//   type: 'object',
//   required: ['firstName', 'lastName'],

//   properties: {
//     id: { type: 'integer' },
//     parentId: { type: ['integer', 'null'] },
//     firstName: { type: 'string', minLength: 1, maxLength: 255 },
//     lastName: { type: 'string', minLength: 1, maxLength: 255 },
//     age: { type: 'number' },

//     // Properties defined as objects or arrays are
//     // automatically converted to JSON strings when
//     // writing to database and back to objects and arrays
//     // when reading from database. To override this
//     // behaviour, you can override the
//     // Person.jsonAttributes property.
//     address: {
//       type: 'object',
//       properties: {
//         street: { type: 'string' },
//         city: { type: 'string' },
//         zipCode: { type: 'string' }
//       }
//     }
//   }
// }

// export const app = {
//   domain: 'mysite.org',
//   database: {
//     connection: {
//       client: 'mysql2',
//       connection: {
//         host: '127.0.0.1',
//         user: 'root',
//         password: 'Babble01',
//         database: 'stoneware'
//       }
//     },
//     models: [jsonSchema]
//   }
// }
module.exports = { a: 2 }
