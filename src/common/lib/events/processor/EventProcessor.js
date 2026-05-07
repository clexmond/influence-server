const { delay } = require('lodash');
const { Timer } = require('timer-node');
const { eachSeries } = require('async');
const EventService = require('@common/services/Event');
const { StarknetBlockCache } = require('@common/lib/cache');
const logger = require('@common/lib/logger');
const eventEmitter = require('@common/lib/sio/emitter');
const EventConfig = require('./config');

class EventProcessor {
  constructor(props = {}) {
    if (!props.runDelay) throw new Error('Missing required value for runDelay');
    this.runDelay = props.runDelay;
  }

  async process({ events }) {
    return eachSeries(events, async (event) => {
      const { address, event: eventName } = event;
      if (!address || !eventName) throw new Error('Missing required value for address or event');
      const EventHandlerClass = EventConfig.getHandlerByAddressAndEvent({ address, eventName });

      if (!EventHandlerClass) {
        logger.warn(`Missing handler for address: ${address} and event: ${eventName}`);
        return;
      }

      const handler = new EventHandlerClass(event);
      await handler.processEvent();
      await handler.finalizeEvent();
      await handler.emitSocketEvents();
    });
  }

  async emitCachedStarknetBlockNumber() {
    const rawCurrentBlockNumber = await StarknetBlockCache.getCurrentBlockNumber();
    const currentBlockNumber = (rawCurrentBlockNumber === null || typeof rawCurrentBlockNumber === 'undefined')
      ? Number.NaN
      : Number(rawCurrentBlockNumber);
    const rawPrevious = await StarknetBlockCache.getLastEmittedCurrentBlockNumber();
    const previous = (rawPrevious === null || typeof rawPrevious === 'undefined') ? Number.NaN : Number(rawPrevious);

    if (!Number.isFinite(currentBlockNumber) || currentBlockNumber === previous) return false;

    const rawBlockTimestamp = await StarknetBlockCache.getCurrentBlockTimestamp();
    const blockTimestamp = (rawBlockTimestamp === null || typeof rawBlockTimestamp === 'undefined')
      ? Number.NaN
      : Number(rawBlockTimestamp);
    const body = {
      blockNumber: currentBlockNumber,
      previous: Number.isFinite(previous) ? previous : null
    };

    if (Number.isFinite(blockTimestamp)) {
      body.blockTimestamp = blockTimestamp;
    }

    await eventEmitter.broadcast({
      type: 'CURRENT_STARKNET_BLOCK_NUMBER',
      body
    });
    await StarknetBlockCache.setLastEmittedCurrentBlockNumber(currentBlockNumber);
    logger.debug(
      [
        'EventProcessor::emitCachedStarknetBlockNumber, emitted CURRENT_STARKNET_BLOCK_NUMBER',
        `blockNumber=${currentBlockNumber}`,
        `previous=${previous}`,
        ...(Number.isFinite(blockTimestamp) ? [`blockTimestamp=${blockTimestamp}`] : [])
      ].join(' ')
    );
    return true;
  }

  async emitCachedStarknetBlockNumberIfCaughtUp() {
    const remainingEvents = await EventService.getNonProcessed({ limit: 1 });
    if (remainingEvents.length > 0) return false;

    return this.emitCachedStarknetBlockNumber();
  }

  async main({ timeStamp } = {}) {
    const timer = new Timer({ label: 'EventProcessor-timer' }).start();
    const events = (timeStamp) ? await EventService.getFromTimestamp({ limit: 1000, timeStamp })
      : await EventService.getNonProcessed({ limit: 1000 });
    logger.info(`EventProcessor::main, event(s) to process: ${events.length}`);

    await this.process({ events });
    if (typeof timeStamp === 'undefined' || timeStamp === null) {
      await this.emitCachedStarknetBlockNumberIfCaughtUp();
    }

    // if time elapsed is greater than the run delay, run now, else delay the diff
    if (timer.ms() > this.runDelay) return this.main();
    const delayMs = this.runDelay - timer.ms();
    logger.info(`EventProcessor::main, run delay not met, delaying for [${delayMs}ms]...`);
    return new Promise(() => {
      delay(() => this.main(), delayMs);
    });
  }
}

module.exports = EventProcessor;
