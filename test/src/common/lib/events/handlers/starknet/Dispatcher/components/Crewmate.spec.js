const { expect } = require('chai');
const mongoose = require('mongoose');
const { OpenSea } = require('@common/lib/marketplaces');
const { ElasticSearchService } = require('@common/services');
const Handler = require('@common/lib/events/handlers/starknet/Dispatcher/components/Crewmate');

describe('ComponentUpdated: Crewmate Handler', function () {
  let event;
  const stubs = {
    OpenSea: null,
    queueEntityForIndexing: null
  };

  beforeEach(function () {
    event = mongoose.model('Starknet')({
      event: 'ComponentUpdated_Crewmate',
      blockNumber: 1,
      transactionHash: '0x1',
      logIndex: 1,
      timestamp: 1,
      data: [
        '0x1', '0x10001', '0x1', '0x2', '0x3', '0x4', '0x5',
        '0x3', '0xb', '0x16', '0x21',
        '0x4', '0x37', '0x42', '0x4d', '0x58'
      ],
      returnValues: {
        entity: { label: 1, id: 1 },
        status: 1,
        coll: 2,
        class: 3,
        title: 4,
        appearance: '0x5',
        cosmetic: [11, 22, 33],
        impactful: [55, 66, 77, 88]
      }
    });

    stubs.OpenSea = this._sandbox.stub(OpenSea, 'updateCrewmateAsset').resolves();
    stubs.queueEntityForIndexing = this._sandbox.stub(ElasticSearchService, 'queueEntityForIndexing').resolves();
  });

  afterEach(function () {
    return this.utils.resetCollections(['CrewmateComponent']);
  });

  describe('processEvent', function () {
    it('should create/update the CrewmateComponent', async function () {
      await (new Handler(event)).processEvent();
      const docs = await mongoose.model('CrewmateComponent').find().lean();
      expect(docs).to.have.lengthOf(1);
    });

    it('queue the entity for indexing', async function () {
      await (new Handler(event)).processEvent();
      expect(stubs.queueEntityForIndexing.calledOnce).to.equal(true);
    });

    it('should attempt to update OpenSea', async function () {
      await (new Handler(event)).processEvent();
      expect(stubs.OpenSea.calledOnce).to.equal(true);
    });
  });

  describe('transformEventData', function () {
    it('should transform the data correctly', function () {
      expect(Handler.transformEventData(event)).to.deep.equal(event.returnValues);
    });
  });
});
