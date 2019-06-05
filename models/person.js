// import { Model } from 'objection'

export default (Model) => {
  return class Person extends Model {
    get fullName () {
      return `${this.firstName} ${this.lastName}`
    }
  }
}
