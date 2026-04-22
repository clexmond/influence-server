const { expect } = require('chai');
const sinon = require('sinon');
const moment = require('moment');
const appConfig = require('config');
const BlockCache = require('@common/lib/cache/Starknet');
const { ActivityService, StarknetEventService } = require('@common/services');
const StarknetBlock = require('@common/lib/starknet/models/Block');
const { StarknetRetriever } = require('@common/lib/events/retrievers/starknet/retriever');
const StarknetEventConfig = require('../../../../../../../src/common/lib/events/retrievers/starknet/config');

const fakeBlocks = function ({ l1Blocks = 1, l2Blocks = 2 }) {
  const blocks = [];
  const timestamp = moment();
  for (let i = 1; i <= l1Blocks; i += 1) {
    timestamp.add(i, 'm');
    const transactionReceipts = [{
      transaction_hash: '0x1',
      events: [{ data: [], address: 1, keys: [] }]
    }];
    const data = {
      block_number: i,
      block_hash: i,
      status: 'ACCEPTED_ON_L1',
      timestamp: Number(timestamp.format('x')),
      transactions: ['0x1'],
      transaction_receipts: transactionReceipts
    };
    blocks.push(new StarknetBlock(data));
  }
  for (let i = 1; i <= l2Blocks; i += 1) {
    timestamp.add(i, 'm');
    const transactionReceipts = [{
      transaction_hash: '0x1',
      events: [{ data: [], address: 1, keys: [] }] }];
    const data = {
      block_number: l1Blocks + i,
      block_hash: l1Blocks + i,
      status: 'ACCEPTED_ON_L2',
      timestamp: Number(timestamp.format('x')),
      transactions: ['0x1'],
      transaction_receipts: transactionReceipts
    };
    blocks.push(new StarknetBlock(data));
  }
  return blocks;
};

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

  describe('getFromToBlocks', function () {
    it('should return a block that is the last L1 accepted block', async function () {
      await BlockCache.setl1AcceptedBlock(1);
      const result = await retriever.getLastL1CachedBlock();
      expect(result).to.eql(1);
    });

    it('should return one prior to STARKNET_ORIGIN_BLOCK value if no cached l1 accepted block', async function () {
      await BlockCache.reset();
      const result = await retriever.getLastL1CachedBlock();
      expect(result).to.eql(0);
    });
  });

  describe('findLastSyncedBlock', function () {
    it('should return the last block if all are synced', async function () {
      const getBlockStub = sandbox.stub(retriever.provider, 'getBlock');
      getBlockStub.withArgs('1').returns({ blockHash: 1 });
      getBlockStub.withArgs('2').returns({ blockHash: 2 });
      getBlockStub.withArgs('3').returns({ blockHash: 3 });
      getBlockStub.withArgs('4').returns({ blockHash: 4 });
      getBlockStub.withArgs('5').returns({ blockHash: 5 });

      let cachedBlocks = fakeBlocks({ l2Blocks: 4 });
      cachedBlocks = cachedBlocks.reduce((o, block) => ({ ...o, [block.blockNumber]: block.blockHash }), {});
      const blockNumbers = Object.keys(cachedBlocks).sort((a, b) => Number(a) - Number(b));
      const result = await retriever.findLastSyncedBlock({ blockNumbers, cachedBlocks });
      expect(Number(result)).to.eql(5);
    });

    it('should return the last synced block if mismatched hashes', async function () {
      const getBlockStub = sandbox.stub(retriever.provider, 'getBlock');
      getBlockStub.withArgs('1').returns({ blockHash: 1 });
      getBlockStub.withArgs('2').returns({ blockHash: 2 });
      getBlockStub.withArgs('3').returns({ blockHash: 3 });
      getBlockStub.withArgs('4').returns({ blockHash: 42 });
      getBlockStub.withArgs('5').returns({ blockHash: 43 });

      let cachedBlocks = fakeBlocks({ l2Blocks: 4 });
      cachedBlocks = cachedBlocks.reduce((o, block) => ({ ...o, [block.blockNumber]: block.blockHash }), {});
      const blockNumbers = Object.keys(cachedBlocks).sort((a, b) => Number(a) - Number(b));
      const result = await retriever.findLastSyncedBlock({ blockNumbers, cachedBlocks });
      expect(Number(result)).to.eql(3);
    });

    it('should return the first block if none match', async function () {
      const getBlockStub = sandbox.stub(retriever.provider, 'getBlock');
      getBlockStub.withArgs('1').returns({ blockHash: 39 });
      getBlockStub.withArgs('2').returns({ blockHash: 40 });
      getBlockStub.withArgs('3').returns({ blockHash: 41 });
      getBlockStub.withArgs('4').returns({ blockHash: 42 });
      getBlockStub.withArgs('5').returns({ blockHash: 43 });

      let cachedBlocks = fakeBlocks({ l2Blocks: 4 });
      cachedBlocks = cachedBlocks.reduce((o, block) => ({ ...o, [block.blockNumber]: block.blockHash }), {});
      const blockNumbers = Object.keys(cachedBlocks).sort((a, b) => Number(a) - Number(b));
      const result = await retriever.findLastSyncedBlock({ blockNumbers, cachedBlocks });
      expect(Number(result)).to.eql(1);
    });
  });

  describe('processBlock', function () {
    beforeEach(async function () {
      await BlockCache.reset();
    });

    it('should proccess and update cache correctly for non-aborted blocks', async function () {
      const blocks = fakeBlocks({ l1Blocks: 2, l2Blocks: 2 });
      sandbox.stub(retriever, 'pullAndFormatEvents').callsFake(async () => {
        const timestamp = moment();
        const events = blocks.reduce((acc, block) => {
          acc.push(...block.transactionReceipts[0].events.map((e) => ({
            ...e.toObject(),
            event: 'foo',
            timestamp: Number(timestamp.format('x'))
          })));
          return acc;
        }, []);
        return events;
      });

      for (let b = 0; b < blocks.length; b += 1) {
        await retriever.processBlock(blocks[b]);
      }

      const l1Cache = await BlockCache.getl1AcceptedBlock();
      const l2Cache = await BlockCache.getl2AcceptedBlocks();
      expect(Object.keys(l2Cache).length).to.eql(2);
      expect(l1Cache).to.eql(2);
    });

    it('should handle an aborted block (cached hash mismatch)', async function () {
      const blocks = fakeBlocks({ l1Blocks: 0, l2Blocks: 3 });
      await BlockCache.setl2AcceptedBlocks(blocks.reduce((acc, block) => {
        acc[block.blockNumber] = (block.blockHash >= 2) ? (block.blockHash + 9) : block.blockHash;
        return acc;
      }, {}));

      try {
        for (let b = 0; b < blocks.length; b += 1) {
          await retriever.processBlock(blocks[b]);
        }
      } catch (error) {
        expect(error.message).to.deep.include('Aborted block detected');
      }

      const l2Cache = await BlockCache.getl2AcceptedBlocks();
      expect(Object.keys(l2Cache).length).to.eql(1);
      expect(l2Cache['1']).to.eql(1);
    });
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
  });
});
