const { expect } = require('chai');
const mongoose = require('mongoose');
const { ElasticSearchService } = require('@common/services');
const Handler = require('@common/lib/events/handlers/starknet/Dispatcher/components/agreements/PrepaidAuction');

describe('ComponentUpdated: PrepaidAgreementAuction Handler', function () {
  let event;

  beforeEach(function () {
    event = mongoose.model('Starknet')({
      event: 'ComponentUpdated_PrepaidAgreementAuction',
      logIndex: 1,
      timestamp: 1695691834,
      transactionIndex: 1,
      transactionHash: '0x123456789',
      data: [
        '0x3',
        '0x1000000010004',
        '0x1',
        '0x651af72e'
      ],
      returnValues: {
        entity: { id: 4294967297, label: 4 },
        status: 1,
        startTime: 1696266030
      }
    });

    this._sandbox.stub(ElasticSearchService, 'queueEntityForIndexing').resolves();
  });

  afterEach(function () {
    return this.utils.resetCollections(['PrepaidAgreementAuctionComponent']);
  });

  describe('processEvent', function () {
    it('should create/update the PrepaidAgreementAuctionComponent doc', async function () {
      await (new Handler(event)).processEvent();
      const docs = await mongoose.model('PrepaidAgreementAuctionComponent').find().lean();
      expect(docs).to.have.lengthOf(1);
      expect(docs[0].status).to.equal(1);
    });
  });

  describe('transformEventData', function () {
    it('should transform the data correctly', function () {
      expect(Handler.transformEventData(event)).to.deep.equal(event.returnValues);
    });
  });
});
