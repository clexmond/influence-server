const { expect } = require('chai');
const sinon = require('sinon');
const { StarknetBlockCache } = require('@common/lib/cache');
const EventService = require('@common/services/Event');
const eventEmitter = require('@common/lib/sio/emitter');
const EventProcessor = require('@common/lib/events/processor/EventProcessor');

describe('EventProcessor', function () {
  let processor;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    processor = new EventProcessor({ runDelay: 5000 });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('emitCachedStarknetBlockNumber', function () {
    it('should emit the cached current starknet block number with the current block timestamp', async function () {
      sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
      sandbox.stub(StarknetBlockCache, 'getLastEmittedCurrentBlockNumber').resolves(9542286);
      sandbox.stub(StarknetBlockCache, 'getCurrentBlockTimestamp').resolves(1778144596);
      const broadcastStub = sandbox.stub(eventEmitter, 'broadcast').resolves();
      const setLastEmittedStub = sandbox.stub(StarknetBlockCache, 'setLastEmittedCurrentBlockNumber').resolves();

      const emitted = await processor.emitCachedStarknetBlockNumber();

      expect(emitted).to.equal(true);
      expect(broadcastStub.calledOnceWithExactly({
        type: 'CURRENT_STARKNET_BLOCK_NUMBER',
        body: {
          blockNumber: 9542288,
          previous: 9542286,
          blockTimestamp: 1778144596
        }
      })).to.equal(true);
      expect(setLastEmittedStub.calledOnceWithExactly(9542288)).to.equal(true);
    });

    it('should not emit when the cached current starknet block has already been emitted', async function () {
      sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
      sandbox.stub(StarknetBlockCache, 'getLastEmittedCurrentBlockNumber').resolves(9542288);
      const broadcastStub = sandbox.stub(eventEmitter, 'broadcast').resolves();

      const emitted = await processor.emitCachedStarknetBlockNumber();

      expect(emitted).to.equal(false);
      expect(broadcastStub.called).to.equal(false);
    });
  });

  describe('emitCachedStarknetBlockNumberIfCaughtUp', function () {
    it(
      'should emit the cached current starknet block number when there is no remaining processor backlog',
      async function () {
        sandbox.stub(EventService, 'getNonProcessed').resolves([]);
        const emitStub = sandbox.stub(processor, 'emitCachedStarknetBlockNumber').resolves(true);

        const emitted = await processor.emitCachedStarknetBlockNumberIfCaughtUp();

        expect(emitted).to.equal(true);
        expect(emitStub.calledOnce).to.equal(true);
      }
    );

    it(
      'should not emit the cached current starknet block number when there is remaining processor backlog',
      async function () {
        sandbox.stub(EventService, 'getNonProcessed').resolves([{ _id: 'evt1' }]);
        const emitStub = sandbox.stub(processor, 'emitCachedStarknetBlockNumber').resolves(true);

        const emitted = await processor.emitCachedStarknetBlockNumberIfCaughtUp();

        expect(emitted).to.equal(false);
        expect(emitStub.called).to.equal(false);
      }
    );
  });
});
