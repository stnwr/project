// import { Model } from 'objection'

export default (Model) => {
  return class Product extends Model {
    get longDescription () {
      return `${this.code} ${this.name} (${this.description})`
    }
  }
}
