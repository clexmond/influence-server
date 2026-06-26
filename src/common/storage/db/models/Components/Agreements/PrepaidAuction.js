const { Schema, model } = require('mongoose');
const { uniquePathPlugin } = require('@common/storage/db/plugins');
const { ChainComponent } = require('@common/storage/db/schemas');

const schema = new Schema([
  ChainComponent, {
    status: { type: Number },
    startTime: { type: Number }
  }
], {
  collection: 'Component_PrepaidAgreementAuction',
  pluginTags: ['useEntitiesPlugin']
});

schema
  .plugin(uniquePathPlugin, ['entity.uuid'])
  .index({ 'entity.uuid': 1 }, { unique: true });

module.exports = model('PrepaidAgreementAuctionComponent', schema);
