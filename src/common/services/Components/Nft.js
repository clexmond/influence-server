const mongoose = require('mongoose');
const { isNil } = require('lodash');
const { Address } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');

class NftComponentService {
  static findByOwner(owner, label = null) {
    const filter = {
      $or: [
        { 'owners.ethereum': Address.toStandard(owner, 'ethereum') },
        { 'owners.starknet': Address.toStandard(owner, 'starknet') }
      ]
    };
    if (label) Object.assign(filter, { 'entity.label': label });

    return mongoose.model('NftComponent').find(filter);
  }

  static findAsteroidNftsByOwner(owner) {
    return this.findByOwner(owner, Entity.IDS.ASTEROID);
  }

  static findOne(filter, { lean = true } = {}) {
    const action = mongoose.model('NftComponent').findOne(filter);
    if (lean) action.lean();
    return action;
  }

  static async isOwner(address, entity) {
    if (!address) throw new Error('Missing address');
    if (!entity) throw new Error('Missing entity');
    const _entity = Entity.toEntity(entity);
    const filter = {
      'entity.uuid': _entity.uuid,
      $or: [
        { 'owners.ethereum': Address.toStandard(address, 'ethereum') },
        { 'owners.starknet': Address.toStandard(address, 'starknet') }
      ]
    };

    const result = await mongoose.model('NftComponent').exists(filter);
    return !isNil(result);
  }

  static updateOne(filter, update) {
    return mongoose.model('NftComponent').updateOne(filter, update, { upsert: true });
  }
}

module.exports = NftComponentService;
