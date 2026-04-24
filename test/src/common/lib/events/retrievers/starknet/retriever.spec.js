const { expect } = require('chai');
const sinon = require('sinon');
const appConfig = require('config');
const { ActivityService, StarknetEventService } = require('@common/services');
const { StarknetRetriever } = require('@common/lib/events/retrievers/starknet/retriever');
const StarknetEventConfig = require('../../../../../../../src/common/lib/events/retrievers/starknet/config');

class FakeHandler {
  static ignore = true;

  static parseEvent() {
    return {};
  }
}

describe('Starknet Event Retriever', function () {
  let retriever;
  let configState;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  before(function () {
    configState = appConfig.util.cloneDeep(appConfig);

    appConfig.Starknet.rpcProvider = 'FAKE_STARKNET_RPC_PROVIDER';
    appConfig.Starknet.originBlock = 1;

    retriever = new StarknetRetriever();
  });

  after(function () {
    Object.assign(appConfig, configState);
  });

  describe('pullAndFormatEvents', function () {
    beforeEach(function () {
      sandbox.stub(StarknetEventConfig, 'toArray').returns([{
        address: '0x1',
        handlers: { '0x1': FakeHandler }
      }]);

      sandbox.stub(retriever.provider, 'getEvents').resolves([{
        address: '0x1',
        data: [],
        keys: ['0x1']
      }]);

      sandbox.stub(StarknetEventConfig, 'getHandler').returns(FakeHandler);
    });

    it('should skip events with ignore: true', async function () {
      const results = await retriever.pullAndFormatEvents({ blockNumber: 1 });
      expect(results.length).to.eql(0);
    });

    it('should not skip events with ignore: false or undefined', async function () {
      FakeHandler.ignore = false;
      let results = await retriever.pullAndFormatEvents({ blockNumber: 1 });
      expect(results.length).to.eql(1);

      FakeHandler.ignore = undefined;
      results = await retriever.pullAndFormatEvents({ blockNumber: 1 });
      expect(results.length).to.eql(1);
    });
  });

  describe('auditOnce', function () {
    it('should reconcile a mismatched block', async function () {
      const chainEvent = {
        blockNumber: 12,
        event: 'CrewStationedV1',
        transactionHash: '0x1',
        logIndex: 0,
        blockHash: '0xabc'
      };
      const storedEvent = { ...chainEvent, blockHash: '0xdef' };

      sandbox.stub(retriever.provider, 'getBlockNumber').resolves(15);
      sandbox.stub(retriever, 'pullAndFormatEvents').resolves([chainEvent]);
      sandbox.stub(StarknetEventService, 'getEventsByBlockRange').resolves([storedEvent]);
      const removeStub = sandbox.stub(StarknetEventService, 'updateManyAsRemoved').resolves();
      const purgeStub = sandbox.stub(ActivityService, 'purgeByRemoved').resolves();
      const upsertStub = sandbox.stub(StarknetEventService, 'updateOrCreateMany').resolves();

      const result = await retriever.auditOnce({ blockOffset: 10 });

      expect(result.startBlock).to.eql(5);
      expect(result.headBlock).to.eql(15);
      expect(result.mismatchedBlocks).to.eql(1);
      expect(removeStub.calledOnceWithExactly({ blockNumber: 12 })).to.eql(true);
      expect(purgeStub.calledOnce).to.eql(true);
      expect(upsertStub.calledOnceWithExactly([chainEvent])).to.eql(true);
    });

    it('should not reconcile matching blocks', async function () {
      const chainEvent = {
        blockNumber: 14,
        event: 'CrewStationedV1',
        transactionHash: '0x2',
        logIndex: 1,
        blockHash: '0x999'
      };

      sandbox.stub(retriever.provider, 'getBlockNumber').resolves(20);
      sandbox.stub(retriever, 'pullAndFormatEvents').resolves([chainEvent]);
      sandbox.stub(StarknetEventService, 'getEventsByBlockRange').resolves([chainEvent]);
      const removeStub = sandbox.stub(StarknetEventService, 'updateManyAsRemoved').resolves();
      const purgeStub = sandbox.stub(ActivityService, 'purgeByRemoved').resolves();
      const upsertStub = sandbox.stub(StarknetEventService, 'updateOrCreateMany').resolves();

      const result = await retriever.auditOnce({ blockOffset: 10 });

      expect(result.startBlock).to.eql(10);
      expect(result.headBlock).to.eql(20);
      expect(result.mismatchedBlocks).to.eql(0);
      expect(removeStub.called).to.eql(false);
      expect(purgeStub.called).to.eql(false);
      expect(upsertStub.called).to.eql(false);
    });

    it('should process large audit ranges in batches', async function () {
      sandbox.stub(retriever.provider, 'getBlockNumber').resolves(1002);
      const pullStub = sandbox.stub(retriever, 'pullAndFormatEvents').resolves([]);
      const storedStub = sandbox.stub(StarknetEventService, 'getEventsByBlockRange').resolves([]);
      const removeStub = sandbox.stub(StarknetEventService, 'updateManyAsRemoved').resolves();
      const purgeStub = sandbox.stub(ActivityService, 'purgeByRemoved').resolves();
      const upsertStub = sandbox.stub(StarknetEventService, 'updateOrCreateMany').resolves();

      const result = await retriever.auditOnce({ blockOffset: 1001 });

      expect(result.startBlock).to.eql(1);
      expect(result.headBlock).to.eql(1002);
      expect(result.mismatchedBlocks).to.eql(0);

      expect(pullStub.callCount).to.eql(2);
      expect(pullStub.getCall(0).calledWithExactly({ fromBlock: 1, toBlock: 1000 })).to.eql(true);
      expect(pullStub.getCall(1).calledWithExactly({ fromBlock: 1001, toBlock: 1002 })).to.eql(true);

      expect(storedStub.callCount).to.eql(2);
      expect(storedStub.getCall(0).calledWithExactly(1, 1000)).to.eql(true);
      expect(storedStub.getCall(1).calledWithExactly(1001, 1002)).to.eql(true);

      expect(removeStub.called).to.eql(false);
      expect(purgeStub.called).to.eql(false);
      expect(upsertStub.called).to.eql(false);
    });
  });

  describe('runOnce', function () {
    it('should process from/to in range batches when onlyMisingBlocks is false', async function () {
      const retrieveStub = sandbox.stub(retriever, 'retrieveAndProcessRange').resolves(0);
      const hasEventsStub = sandbox.stub(StarknetEventService, 'hasEventsForBlock');

      await retriever.runOnce({ fromBlock: 1, toBlock: 2500, onlyMisingBlocks: false });

      expect(hasEventsStub.called).to.eql(false);
      expect(retrieveStub.callCount).to.eql(4);
      expect(retrieveStub.getCall(0).calledWithExactly({ fromBlock: 1, toBlock: 1000 })).to.eql(true);
      expect(retrieveStub.getCall(1).calledWithExactly({ fromBlock: 1001, toBlock: 2000 })).to.eql(true);
      expect(retrieveStub.getCall(2).calledWithExactly({ fromBlock: 2001, toBlock: 2500 })).to.eql(true);
      expect(retrieveStub.getCall(3).calledWithExactly({ fromBlock: 'pre_confirmed', toBlock: 'pre_confirmed' }))
        .to.eql(true);
    });

    it('should keep per-block checks when onlyMisingBlocks is true', async function () {
      const retrieveStub = sandbox.stub(retriever, 'retrieveAndProcessRange').resolves(0);
      const hasEventsStub = sandbox.stub(StarknetEventService, 'hasEventsForBlock');
      hasEventsStub.withArgs(1).resolves(true);
      hasEventsStub.withArgs(2).resolves(false);
      hasEventsStub.withArgs(3).resolves(true);

      await retriever.runOnce({ fromBlock: 1, toBlock: 3, onlyMisingBlocks: true });

      expect(hasEventsStub.callCount).to.eql(3);
      expect(retrieveStub.callCount).to.eql(2);
      expect(retrieveStub.getCall(0).calledWithExactly({ fromBlock: 2, toBlock: 2 })).to.eql(true);
      expect(retrieveStub.getCall(1).calledWithExactly({ fromBlock: 'pre_confirmed', toBlock: 'pre_confirmed' }))
        .to.eql(true);
    });
  });
});
