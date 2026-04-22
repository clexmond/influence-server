const appConfig = require('config');
const { delay, groupBy, omitBy } = require('lodash');
const { Timer } = require('timer-node');
const logger = require('@common/lib/logger');
const { ActivityService, StarknetEventService } = require('@common/services');
const StarknetProvider = require('@common/lib/starknet/provider');
const { StarknetBlockCache } = require('@common/lib/cache');
const { PRE_CONFIRMED_BLOCK_NUMBER } = require('@common/lib/starknet/models/constants');
const StarknetEventConfig = require('./config');

class StarknetRetriever {
  constructor(props = {}) {
    const rpcEndpoint = appConfig.get('EventRetriever.starknet.rpcProvider');

    this.provider = new StarknetProvider({
      ...(rpcEndpoint ? { rpcEndpoint } : {}),
      ...props
    });
  }

  static getEventFingerprint(event) {
    return [
      event.event,
      event.transactionHash,
      event.logIndex,
      event.blockHash
    ].join(':');
  }

  getTrackedAddresses() {
    return StarknetEventConfig.toArray().map(({ address }) => address);
  }

  hasBlockEventsChanged({ chainEvents = [], storedEvents = [] }) {
    if (chainEvents.length !== storedEvents.length) return true;

    const chainSet = new Set(chainEvents.map(StarknetRetriever.getEventFingerprint));
    for (const fingerprint of storedEvents.map(StarknetRetriever.getEventFingerprint)) {
      if (!chainSet.has(fingerprint)) return true;
    }

    return false;
  }

  // The intention of this method is to run on a delay behind the current runner N number of blocks behind
  // the current block number with the intent to catch any missed events that were not available per the provider
  // when first retrieved. This method should be run in a separate process to avoid blocking/overlapping with the
  // main runner process.
  async auditOnce({ blockOffset = 10 } = {}) {
    const logSlug = 'StarknetAuditRetriever::auditOnce';
    const originBlock = Number(appConfig.get('Starknet.originBlock'));
    const parsedBlockOffset = Number(blockOffset);
    if (!Number.isFinite(parsedBlockOffset) || parsedBlockOffset < 0) {
      throw new Error(`Invalid blockOffset: ${blockOffset}`);
    }

    // need to get the current head block in order to determine the starting block - offset
    const headBlock = Number(await this.provider.getBlockNumber());
    const startBlock = Math.max(originBlock, headBlock - parsedBlockOffset);
    logger.info(`${logSlug}, headBlock -> startBlock: ${startBlock} -> ${headBlock}`);

    const chainEvents = await this.pullAndFormatEvents({ fromBlock: startBlock, toBlock: headBlock });
    const chainEventsByBlock = groupBy(chainEvents, 'blockNumber');
    const storedEvents = await StarknetEventService.getEventsByBlockRange(startBlock, headBlock);
    const storedEventsByBlock = groupBy(storedEvents, 'blockNumber');

    let mismatchedBlocks = 0;
    for (let blockNumber = startBlock; blockNumber <= headBlock; blockNumber += 1) {
      const blockChainEvents = chainEventsByBlock[blockNumber] || [];
      const blockStoredEvents = storedEventsByBlock[blockNumber] || [];
      logger.info(
        `${logSlug}, block [${blockNumber}], chain: ${blockChainEvents.length}, stored: ${blockStoredEvents.length}`
      );

      if (this.hasBlockEventsChanged({ chainEvents: blockChainEvents, storedEvents: blockStoredEvents })) {
        mismatchedBlocks += 1;
        logger.warn(`${logSlug}, mismatch detected on block [${blockNumber}], reconciling`);

        if (blockStoredEvents.length > 0) {
          await StarknetEventService.updateManyAsRemoved({ blockNumber });
          await ActivityService.purgeByRemoved();
        }

        if (blockChainEvents.length > 0) {
          await StarknetEventService.updateOrCreateMany(blockChainEvents);
        }
      }
    }

    return { headBlock, mismatchedBlocks, startBlock };
  }

  async auditRunner({ runDelay, blockOffset = 10 } = {}) {
    const _runDelay = Number(runDelay || appConfig.EventRetriever.starknet?.auditRunDelay);
    if (!_runDelay) throw new Error('No run delay provided');
    const keepRunning = true;

    while (keepRunning) {
      const timer = new Timer({ label: 'StarknetAuditRetriever-timer' }).start();
      const logSlug = 'StarknetAuditRetriever::auditRunner';
      await this.auditOnce({ blockOffset });

      if (timer.ms() < _runDelay) {
        const delayMs = _runDelay - timer.ms();
        logger.info(`${logSlug}, run delay not met, delaying for [${delayMs}ms]...`);
        await new Promise((resolve) => { delay(resolve, delayMs); });
      }
    }
  }

  async runOnce({ blocks, fromBlock, toBlock, onlyMisingBlocks = false } = {}) {
    if (blocks) {
      logger.info(`StarknetRetriever::runOnce, blocks: ${blocks}`);
      for (const block of blocks.map(Number)) {
        if (onlyMisingBlocks) {
          const exists = await StarknetEventService.hasEventsForBlock(block);
          if (exists) {
            logger.info(`StarknetRetriever::runOnce, events found on [${block}], skipping`);
            continue; // eslint-disable-line no-continue
          }
        }
        await this.retrieveAndProcessRange({ fromBlock: block, toBlock: block });
      }
    } else {
      const _fromBlock = Number(fromBlock || appConfig.get('Starknet.originBlock'));
      const _toBlock = (toBlock === 'latest' || typeof toBlock === 'undefined' || toBlock === null)
        ? await this.provider.getBlockNumber()
        : Number(toBlock);

      logger.info(`StarknetRetriever::runOnce, fromBlock -> toBlock: ${_fromBlock} -> ${_toBlock}`);
      for (let b = _fromBlock; b <= _toBlock; b += 1) {
        if (onlyMisingBlocks) {
          const exists = await StarknetEventService.hasEventsForBlock(b);
          if (exists) {
            logger.info(`StarknetRetriever::runOnce, events found on [${b}], skipping`);
            continue; // eslint-disable-line no-continue
          }
        }
        await this.retrieveAndProcessRange({ fromBlock: b, toBlock: b });
      }
    }

    await this.retrieveAndProcessRange({ fromBlock: 'pre_confirmed', toBlock: 'pre_confirmed' });
  }

  async runner({ runDelay } = {}) {
    const _runDelay = Number(
      runDelay || appConfig.EventRetriever.starknet?.runDelay || appConfig.EventRetriever.runDelay
    );
    if (!_runDelay) throw new Error('No run delay provided');

    const keepRunning = true;
    const originBlock = Number(appConfig.get('Starknet.originBlock'));
    const reconciliationLookback = Number(appConfig.EventRetriever.starknet?.reconciliationLookback || 50);

    while (keepRunning) {
      const logSlug = 'StarknetRetriever::runner';
      const timer = new Timer({ label: 'StarknetRetriever-timer' }).start();
      let fromBlock = originBlock;
      let toBlock = 0;

      try {
        const latestConfirmedEvent = await StarknetEventService.getLatestConfirmedEventByBlock();
        const lastSyncedBlock = Number(await StarknetBlockCache.getl1AcceptedBlock() || originBlock);
        const baseBlock = Math.max(
          Number(latestConfirmedEvent?.blockNumber || originBlock),
          lastSyncedBlock
        );
        fromBlock = Math.max(originBlock, baseBlock - reconciliationLookback);
        toBlock = await this.provider.getBlockNumber();
        logger.info(`${logSlug}, retrieve range [${fromBlock} -> ${toBlock}]`);
        if (Number(fromBlock) <= Number(toBlock)) {
          await this.retrieveAndProcessRange({ fromBlock, toBlock });
          await StarknetBlockCache.setl1AcceptedBlock(toBlock);
        }

        // Always pull PRE_CONFIRMED in each pass to keep recent events fresh.
        await this.retrieveAndProcessRange({ fromBlock: 'pre_confirmed', toBlock: 'pre_confirmed' });
      } catch (error) {
        logger.error(`${logSlug}, runner failed processing from block ${fromBlock} to block ${toBlock}`);
        logger.error(error);
      }

      if (timer.ms() < _runDelay) {
        const delayMs = _runDelay - timer.ms();
        logger.info(`${logSlug}, run delay not met, delaying for [${delayMs}ms]...`);
        await new Promise((resolve) => {
          delay(resolve, delayMs);
        });
      }
    }
  }

  // Internal

  async getLastL1CachedBlock() {
    // Adjust down by one from origin block since the first one won't necessarily be accepted on l1 (on local)
    return (await StarknetBlockCache.getl1AcceptedBlock()) || appConfig.get('Starknet.originBlock') - 1;
  }

  /**
   * @description Pulls events from the provider and formats them for storage
   *
   * @param {Number|String} fromBlock
   * @param {Number|String} toBlock
   * @returns {Array{Object}}
   */
  async pullAndFormatEvents({ blockNumber, fromBlock, toBlock } = {}) {
    const _fromBlock = (typeof blockNumber === 'undefined') ? fromBlock : blockNumber;
    const _toBlock = (typeof blockNumber === 'undefined') ? (toBlock || _fromBlock) : blockNumber;
    if (typeof _fromBlock === 'undefined') throw new Error('Missing required fromBlock value');

    const events = [];
    const rawEvents = await this.provider.getEvents({
      addresses: this.getTrackedAddresses(),
      fromBlock: _fromBlock,
      toBlock: _toBlock
    });
    rawEvents.forEach((event) => {
      const handler = StarknetEventConfig.getHandler(event);
      if (handler) {
        // if the handler is configured to ignore the event, skip it
        if (!handler.ignore) events.push(handler.parseEvent(event));
      } else {
        logger.warn(`Unable to find handler for event: ${JSON.stringify(event)}`);
      }
    });

    return events;
  }

  async retrieveAndProcessRange({ fromBlock, toBlock }) {
    const logSlug = 'StarknetRetriever::retrieveAndProcessRange';
    const events = await this.pullAndFormatEvents({ fromBlock, toBlock });

    if (events.length === 0) {
      logger.info(`${logSlug}, no events found for [${fromBlock} -> ${toBlock}]`);
      return 0;
    }

    logger.info(`${logSlug}, [${events.length}] event(s) on [${fromBlock} -> ${toBlock}]`);
    await StarknetEventService.updateOrCreateMany(events);
    return events.length;
  }

  async findLastSyncedBlock({ blockNumbers, cachedBlocks }) {
    // If there are no blocks in cache just return 0 to start from the beginning
    if (blockNumbers.length === 0) return 0;

    const half = Math.floor(blockNumbers.length / 2);
    const checkBlockNumber = blockNumbers[half];

    // There's only one element in the array so return the last block to start from
    if (half === 0) return checkBlockNumber;

    const block = await this.provider.getBlock(checkBlockNumber);

    // If the block hashes are not equal start running at the previous known synced block
    if (block.blockHash !== cachedBlocks[checkBlockNumber]) return blockNumbers[0];

    // Otherwise recurse until the end
    return this.findLastSyncedBlock({ blockNumbers: blockNumbers.slice(half), cachedBlocks });
  }

  /**
   * @description Handles an aborted block
   *
   * @param {Object} block
   */
  async handleAbortedBlock(block) {
    let l2CachedBlocks = await StarknetBlockCache.getl2AcceptedBlocks();
    const blockNumbersToPurge = Object.keys(l2CachedBlocks).filter((blockNumber) => (blockNumber >= block.blockNumber));
    await StarknetEventService.updateManyAsRemoved({ blockNumber: { $in: blockNumbersToPurge } });

    // Purge activity item(s) that have been marked removed
    await ActivityService.purgeByRemoved();

    // update l2 Accepted cached block(s)
    l2CachedBlocks = omitBy(l2CachedBlocks, (_, blockNumber) => (blockNumbersToPurge.includes(blockNumber)));
    await StarknetBlockCache.setl2AcceptedBlocks(l2CachedBlocks);
  }

  /**
   * @description Processes a block
   *
   * @param {Object} block
   * @param {Object} options
   */
  async processBlock(block, options = {}) {
    const { useCache = true } = options;
    const logSlug = 'StarknetRetriever::processBlock';
    // get the processed cached blocks
    const l2CachedBlocks = await StarknetBlockCache.getl2AcceptedBlocks();

    // check cache
    const l2CachedBlockHash = l2CachedBlocks[block.blockNumber];

    if (l2CachedBlockHash && useCache) {
      if (l2CachedBlockHash !== block.blockHash) {
        // handle aborted block
        logger.warn(`${logSlug}, handling aborted block [${block.blockNumber}] with hash [${block.blockHash}]`);
        await this.handleAbortedBlock(block);

        // break out of loop now. The next run will pull down the new blocks
        throw new Error('Aborted block detected');
      }
      if (l2CachedBlockHash === block.blockHash && block.isAcceptedL1()) {
        await StarknetBlockCache.setl1AcceptedBlock(block.blockNumber);

        // Remove all l2 cached block number(s) up to and incuding the current block number
        // This block is ACCEPTED on l1, we are assuming the previous block as as well
        await StarknetBlockCache.setl2AcceptedBlocks(omitBy(l2CachedBlocks, (__, cachedBlockNumber) => (
          cachedBlockNumber <= block.blockNumber
        )));

        // Update starknet event(s) prior to and including `block.blockNumber` and status accepted on l2
        // to accepted on l1
        await StarknetEventService.updateManyToL1Accepted(block.blockNumber);
        logger.debug(`${logSlug}, block [${block.blockNumber}] status updated to l1Accepted`);
      } else if (l2CachedBlockHash === block.blockHash && block.isAcceptedL2()) {
        logger.debug(`${logSlug}, block [${block.blockNumber}] status still l2Accepted, skipping`);
      }
    } else {
      const events = await this.pullAndFormatEvents(block);

      // save event(s)
      const formattedBlockNumber = (block.blockNumber === PRE_CONFIRMED_BLOCK_NUMBER)
        ? 'PRE_CONFIRMED'
        : block.blockNumber;
      logger.info(`${logSlug}, [${events.length}] event(s) on block ${formattedBlockNumber}`);
      if (events.length > 0) await StarknetEventService.updateOrCreateMany(events);

      if (block.isAcceptedL1() && useCache) {
        await StarknetBlockCache.setl1AcceptedBlock(block.blockNumber);
      } else if (block.isAcceptedL2() && useCache) {
        await StarknetBlockCache.setl2AcceptedBlocks({ ...l2CachedBlocks, [block.blockNumber]: block.blockHash });
      }
    }
  }

  async retrieveAndProcessBlock(blockNumber) {
    const logSlug = 'StarknetRetriever::retrieveAndProcessBlock';
    let block;

    try {
      block = await this.provider.getBlock(blockNumber);
    } catch (error) {
      logger.error(`${logSlug}, getBlock failed: ${blockNumber}`);
      throw error;
    }

    // if the PRE_CONFIRMED block was requested but the returned block is ACCPETED_ON_L2,
    // we can return now. It will get picked up and processed on the next run
    if (blockNumber === 'pre_confirmed' && block.isAcceptedL2()) return;

    try {
      await this.processBlock(block);
    } catch (error) {
      logger.error(`${logSlug}, processBlock failed: [block: ${blockNumber}] ${JSON.stringify(block, null, 2)}`);
      throw error;
    }
  }

  /**
   * @description Processes from the oldest block in L2 accepted cache
   * until the oldest / first L2 accepted block on chain
   *
   * @param {Number} previousLastL1CachedBlock
   * @returns {Number} The last L1 cached block number
   */
  async updateCachedL2BlocksToL1(previousLastL1CachedBlock) {
    const l2CachedBlocks = await StarknetBlockCache.getl2AcceptedBlocks();

    // Adjust down by one from origin block since the first one won't necessarily be accepted on l1 (on local)
    const currentLastL1CachedBlock = await this.getLastL1CachedBlock();

    if (Object.values(l2CachedBlocks).length === 0 || previousLastL1CachedBlock === currentLastL1CachedBlock) {
      return currentLastL1CachedBlock;
    }

    await this.retrieveAndProcessBlock(currentLastL1CachedBlock + 1);
    return this.updateCachedL2BlocksToL1(currentLastL1CachedBlock);
  }
}

module.exports = {
  StarknetRetriever
};
