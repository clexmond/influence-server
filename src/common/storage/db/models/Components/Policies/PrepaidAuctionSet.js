const { Schema, model } = require('mongoose');
const { uniquePathPlugin } = require('@common/storage/db/plugins');
const { ChainComponent } = require('@common/storage/db/schemas');

const schema = new Schema([
  ChainComponent, {
    gracePeriod: { type: Number },
    mode: { type: Number }
  }
], {
  collection: 'Component_PrepaidAgreementAuctionSet',
  pluginTags: ['useEntitiesPlugin']
});

schema
  .plugin(uniquePathPlugin, ['entity.uuid'])
  .index({ 'entity.uuid': 1 }, { unique: true });

module.exports = model('PrepaidAgreementAuctionSetComponent', schema);
