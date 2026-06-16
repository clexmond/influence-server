const { expect } = require('chai');
const mongoose = require('mongoose');
const { ElasticSearchService } = require('@common/services');
const Handler = require('@common/lib/events/handlers/starknet/Dispatcher/components/policies/PrepaidAuctionSet');

describe('ComponentUpdated: PrepaidAgreementAuctionSet Handler', function () {
  let event;

  beforeEach(function () {
    event = mongoose.model('Starknet')({
      event: 'ComponentUpdated_PrepaidAgreementAuctionSet',
      logIndex: 1,
      timestamp: 1695691834,
      transactionIndex: 1,
      transactionHash: '0x123456789',
      data: [
        '0x3',
        '0x10003',
        '0x2',
        '0x3c'
      ],
      returnValues: {
        entity: { id: 1, label: 3 },
        mode: 2,
        gracePeriod: 60
      }
    });

    this._sandbox.stub(ElasticSearchService, 'queueEntityForIndexing').resolves();
  });

  afterEach(function () {
    return this.utils.resetCollections(['PrepaidAgreementAuctionSetComponent']);
  });

  describe('processEvent', function () {
    it('should create/update the PrepaidAgreementAuctionSetComponent doc', async function () {
      await (new Handler(event)).processEvent();
      const docs = await mongoose.model('PrepaidAgreementAuctionSetComponent').find().lean();
      expect(docs).to.have.lengthOf(1);
      expect(docs[0].mode).to.equal(2);
      expect(docs[0].gracePeriod).to.equal(60);
    });
  });

  describe('transformEventData', function () {
    it('should transform the data correctly', function () {
      expect(Handler.transformEventData(event)).to.deep.equal(event.returnValues);
    });
  });
});
