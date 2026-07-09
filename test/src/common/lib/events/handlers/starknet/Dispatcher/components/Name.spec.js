const { expect } = require('chai');
const mongoose = require('mongoose');
const { ElasticSearchService } = require('@common/services');
const Handler = require('@common/lib/events/handlers/starknet/Dispatcher/components/Name');

describe('ComponentUpdated: Name Handler', function () {
  let event;
  const stubs = {
    queueEntityForIndexing: null,
    queueRelatedEntitiesForIndexing: null
  };

  beforeEach(function () {
    event = mongoose.model('Starknet')({
      event: 'ComponentUpdated_Name',
      blockNumber: 1,
      transactionHash: '0x1',
      logIndex: 1,
      timestamp: 1,
      data: [
        '0x1',
        '0x10003',
        '0x546573742041737465726f6964'
      ],
      returnValues: {
        entity: { label: 3, id: 1 },
        name: 'Test Asteroid'
      }
    });

    stubs.queueEntityForIndexing = this._sandbox.stub(ElasticSearchService, 'queueEntityForIndexing').resolves();
    stubs.queueRelatedEntitiesForIndexing = this._sandbox.stub(ElasticSearchService, 'queueRelatedEntitiesForIndexing')
      .resolves();
  });

  afterEach(function () {
    return this.utils.resetCollections(['NameComponent']);
  });

  describe('processEvent', function () {
    it('should create/update the NameComponent', async function () {
      await (new Handler(event)).processEvent();
      const docs = await mongoose.model('NameComponent').find().lean();
      expect(docs).to.have.lengthOf(1);
    });

    it('queue the entity for indexing', async function () {
      await (new Handler(event)).processEvent();
      expect(stubs.queueEntityForIndexing.calledOnce).to.equal(true);
    });

    it('should call _indexRelatedEntities', async function () {
      await (new Handler(event)).processEvent();
      expect(stubs.queueRelatedEntitiesForIndexing.calledOnce).to.eql(true);
    });

    it('should delete the NameComponent if the name is empty', async function () {
      await (new Handler(event)).processEvent();

      event.returnValues.name = '0';
      await (new Handler(event)).processEvent();
      const docs = await mongoose.model('NameComponent').find().lean();
      expect(docs).to.have.lengthOf(0);
    });
  });

  describe('transformEventData', function () {
    it('should transform the data correctly', function () {
      expect(Handler.transformEventData(event)).to.deep.equal(event.returnValues);
    });
  });
});
