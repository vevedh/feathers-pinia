import { Model, ServiceOptions, ServiceGetters } from './types'
import { Params } from '../types'
import { Id } from '@feathersjs/feathers'

import sift from 'sift'
import { _ } from '@feathersjs/commons'
import { filterQuery, sorter, select } from '@feathersjs/adapter-commons'
import { unref } from 'vue'
import fastCopy from 'fast-copy'

const FILTERS = ['$sort', '$limit', '$skip', '$select']
const additionalOperators = ['$elemMatch']

export function makeGetters(options: ServiceOptions): ServiceGetters {
  return {
    // Returns the Feathers service currently assigned to this store.
    service() {
      return options.clients[this.clientAlias].service(this.servicePath)
    },
    items() {
      return Object.values(this.itemsById)
    },
    temps() {
      return Object.values(this.tempsById)
    },
    clones() {
      return Object.values(this.clonesById)
    },
    findInStore() {
      return (params: Params) => {
        params = { ...unref(params) } || {}

        const { paramsForServer, whitelist, itemsById } = this
        const q = _.omit(params.query || {}, paramsForServer)

        const { query, filters } = filterQuery(q, {
          operators: additionalOperators.concat(whitelist),
        })
        let values = _.values(itemsById)

        if (params.temps) {
          values.push(..._.values(this.tempsById))
        }

        values = values.filter(sift(query))

        const total = values.length

        if (filters.$sort) {
          values.sort(sorter(filters.$sort))
        }

        if (filters.$skip) {
          values = values.slice(filters.$skip)
        }

        if (typeof filters.$limit !== 'undefined') {
          values = values.slice(0, filters.$limit)
        }

        if (filters.$select) {
          values = values.map((value) => _.pick(value, ...filters.$select.slice()))
        }

        // Make sure items are instances
        values = values.map((item) => {
          if (item && !item.constructor.modelName) {
            item = this.addOrUpdate(item)
          }
          return item
        })

        return {
          total,
          limit: filters.$limit || 0,
          skip: filters.$skip || 0,
          data: values,
        }
      }
    },
    countInStore() {
      return (params: Params) => {
        params = { ...unref(params) } || {}

        if (!params.query) {
          throw 'params must contain a query-object'
        }

        params.query = _.omit(params.query, ...FILTERS)

        return this.findInStore(params).total
      }
    },
    getFromStore() {
      return (id: Id, params = {}) => {
        id = unref(id)
        params = fastCopy(unref(params) || {})
        const { Model } = options

        let item = this.itemsById[id] && select(params, this.idField)(this.itemsById[id])

        // Make sure item is an instance
        if (item && !item.constructor.modelName) {
          item = this.addOrUpdate(item)
        }
        return item
      }
    },
    isCreatePending() {
      return makePending('create', this)
    },
    isPatchPending() {
      return makePending('patch', this)
    },
    isUpdatePending() {
      return makePending('update', this)
    },
    isRemovePending() {
      return makePending('remove', this)
    },
  }
}

function makePending(method: string, store: any): boolean {
  const isPending = Object.keys(store.pendingById).reduce((isPending, key) => {
    return store.pendingById[key][method] || isPending
  }, false)
  return isPending
}
