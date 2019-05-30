import { Model } from 'objection'

export default class Person extends Model {
  get fullName () {
    return `${this.firstName} ${this.lastName}`
  }
}
