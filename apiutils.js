import findQuery from 'objection-find'

export function createResourceRouteOptions ({ name, Model }) {
  return [
    {
      method: 'get',
      path: `/${name}`,
      handler: (request, h) => {
        return findQuery(Model)
          // .allow(['firstName', 'movies.name', 'children.age', 'parent.lastName'])
          // .allowEager('[children.movies, movies, parent.movies]')
          .build(request.query)
          // .then(function (persons) {
          //   res.send(persons);
          // })
          // .catch(next)
      }
    },
    {
      method: 'post',
      path: `/${name}`,
      handler: async (request, h) => {
        return Model
          .query()
          .insert(request.payload)
      }
    },
    {
      method: 'put',
      path: `/${name}/{id}`,
      handler: async (request, h) => {
        return Model
          .query()
          .updateAndFetchById(request.params.id, request.payload)
      }
    },
    {
      method: 'patch',
      path: `/${name}/{id}`,
      handler: async (request, h) => {
        return Model
          .query()
          .patchAndFetchById(request.params.id, request.payload)
      }
    },
    {
      method: 'delete',
      path: `/${name}/{id}`,
      handler: async (request, h) => {
        return Model
          .query()
          .delete()
          .where('id', '=', request.params.id)
      }
    }
  ]
}
