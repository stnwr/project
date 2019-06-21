// Update with your config settings.

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: '127.0.0.1',
      user: 'root',
      password: 'Babble01',
      database: 'stoneware',
      typeCast (field, next) {
        // Convert 1 to true, 0 to false, and leave null alone
        if (field.type === 'TINY' && field.length === 1) {
          const value = field.string()
          return value ? value === '1' : null
        }
        return next()
      }
    },
    migrations: {
      directory: './db/migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },
  nearlife: {
    client: 'mysql2',
    connection: {
      host: '127.0.0.1',
      user: 'root',
      password: 'Babble01',
      database: 'nearlife',
      typeCast (field, next) {
        // Convert 1 to true, 0 to false, and leave null alone
        if (field.type === 'TINY' && field.length === 1) {
          const value = field.string()
          return value ? value === '1' : null
        }
        return next()
      }
    },
    migrations: {
      directory: './db/nearlife-migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  }
  // ,

  // staging: {
  //   client: 'postgresql',
  //   connection: {
  //     database: 'my_db',
  //     user:     'username',
  //     password: 'password'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // },

  // production: {
  //   client: 'postgresql',
  //   connection: {
  //     database: 'my_db',
  //     user:     'username',
  //     password: 'password'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // }
}
