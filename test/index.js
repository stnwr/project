import assert from 'assert'
import Knex from 'knex'
import db from '../db.json'
import { createDB, createModels } from '../dbutils'

const knex = Knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'Babble01',
    database: 'stoneware'
  }
})

async function testCreateDB () {
  createDB(db, knex)
}

async function testCreateModels () {
  const models = await createModels(db, knex)
  console.log(models)
  createMovies(models)
  createOrders(models)
  createPersonPetsData(models)
}

async function assertInsert (data, Model) {
  const model = await Model
    .query()
    .insert(data)

  assert.ok(model instanceof Model)

  return model
}

async function createOrders (models) {
  const customer = await assertInsert({
    title: 'Mr',
    first_name: 'David',
    last_name: 'Stone',
    ni: Math.random().toString(36).slice(2)
  }, models.Customer)

  const basket = await assertInsert({
    customer_id: customer.id
  }, models.Basket)

  const bread = await assertInsert({
    code: 'P001',
    name: 'Bread',
    description: 'Loafy',
    price: 0.99
  }, models.Product)

  const milk = await assertInsert({
    code: 'P001',
    name: 'Milk',
    description: 'Milky',
    price: 1.50
  }, models.Product)

  const line1 = await assertInsert({
    basket_id: basket.id,
    product_id: milk.id,
    quantity: 2
  }, models.BasketLine)

  const line2 = await assertInsert({
    basket_id: basket.id,
    product_id: bread.id,
    quantity: 1
  }, models.BasketLine)

  const gotCustomer = await models.Customer
    .query()
    .eager('[basket.lines.product]')
    .findById(customer.id)

  const gotBasket = await models.Basket
    .query()
    .eager('[lines.product, customer]')
    // .eager('lines')
    .findById(basket.id)

  const gotBasketLine = await models.BasketLine
    .query()
    .eager('product')
    // .eager('lines')
    .findById(line1.id)

  console.log(line1, line2, gotCustomer, gotBasket, gotBasketLine)
}

async function createMovies (models) {
  const critic1 = await assertInsert({
    title: 'Mr',
    first_name: 'David',
    last_name: 'Stone'
  }, models.Critic)

  const critic2 = await assertInsert({
    title: 'Mr',
    first_name: 'Barry',
    last_name: 'Norman'
  }, models.Critic)

  const movie1 = await assertInsert({
    name: 'Toy Story',
    synopsis: 'Toy adventure',
    year: 1994
  }, models.Movie)

  const movie2 = await assertInsert({
    name: 'Back to the future',
    synopsis: 'Time travel adventure',
    year: 1985
  }, models.Movie)

  const review1 = await assertInsert({
    critic_id: critic1.id,
    movie_id: movie1.id,
    body: 'Excellent!!',
    rating: 5
  }, models.Review)

  const review2 = await assertInsert({
    critic_id: critic1.id,
    movie_id: movie2.id,
    body: 'Great fun!',
    rating: 4
  }, models.Review)

  const review3 = await assertInsert({
    critic_id: critic2.id,
    movie_id: movie1.id,
    body: 'Fab!',
    rating: 5
  }, models.Review)

  const gotCritic1 = await models.Critic
    .query()
    .eager('reviews')
    .findById(critic1.id)

  const gotCritic2 = await models.Critic
    .query()
    .eager('reviews')
    .findById(critic2.id)

  const gotMovie1 = await models.Movie
    .query()
    .eager('reviews')
    .findById(movie1.id)

  const gotMovie2 = await models.Movie
    .query()
    .eager('reviews')
    .findById(movie2.id)

  console.log(critic1, critic2, movie1, movie2, review1, review2, review3, gotCritic1, gotCritic2, gotMovie1, gotMovie2)
}

async function createPersonPetsData (models) {
  const dave = await models.Person
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

  console.log(dave instanceof models.Person) // --> true
  console.log(dave.first_name) // --> 'David'

  const pets = await models.Pet
    .query()
    .eager('owner')
    .orderBy('name')

  const people = await models.Person
    .query()
    .eager('pets')

  const graph = await models.Person
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

  const gotDave = await models.Person
    .query()
    .findById(dave.id)
    .eager('pets')

  // const dave = people[1]
  const sooty2 = await gotDave
    .$relatedQuery('pets')
    .insert({
      name: 'Sooty2',
      owner_id: gotDave.id, // todo
      dob: '1997-01-01',
      description: 'Black and White like Jess the cat2'
    })

  console.log(pets, people, graph, sooty2)
}

// testCreateDB()
testCreateModels()
