const appConfig = require('config');
const logger = require('@common/lib/logger');
const { StarknetBlockCache } = require('@common/lib/cache');
const { ActivityService, StarknetEventService } = require('@common/services');
const { StarknetRetriever } = require('../retrievers/starknet/retriever');
const BaseAuditor = require('./Base');

class StarknetAuditor extends BaseAuditor {
  constructor(props = {}) {
    super({
      name: 'StarknetAuditor',
      runDelay: props.runDelay || appConfig.EventAuditor?.starknet?.runDelay
    });

    this.batchSize = Number(props.batchSize || appConfig.EventAuditor?.starknet?.blockBatchSize || 1000);
    this.originBlock = Number(appConfig.get('Starknet.originBlock'));
    this.retriever = props.retriever || new StarknetRetriever();
  }

  async getTrustedCheckpoint() {
    const existingValue = await StarknetBlockCache.getLastAuditedFinalizedBlock();
    const parsedValue = Number(existingValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  async getFinalizedFrontier() {
    const block = await this.retriever.provider.getBlock('l1_accepted');
    const finalizedBlock = Number(block?.blockNumber);
    return Number.isFinite(finalizedBlock) ? finalizedBlock : this.originBlock - 1;
  }

  async repairChangedBlocks(changedBlocks, chainEventsByBlock, storedEventsByBlock) {
    if (changedBlocks.length === 0) return;
    const transactionHashes = [...new Set(changedBlocks.flatMap((blockNumber) => (
      (storedEventsByBlock[blockNumber] || []).map(({ transactionHash }) => transactionHash)
    )))];
    logger.warn(
      `StarknetAuditor::repairChangedBlocks, repairing [${changedBlocks[0]}`
      + ` -> ${changedBlocks[changedBlocks.length - 1]}]`
      + ` and purging ${transactionHashes.length} transaction hash(es)`
    );

    await StarknetEventService.updateManyAsRemoved({
      blockNumber: { $in: changedBlocks },
      removed: { $ne: true }
    });

    await ActivityService.purgeByTransactionHashes(transactionHashes);

    const canonicalEvents = changedBlocks.flatMap((blockNumber) => chainEventsByBlock[blockNumber] || []);
    if (canonicalEvents.length > 0) await StarknetEventService.updateOrCreateMany(canonicalEvents);
    await StarknetEventService.resetLastProcessedFromBlock(Math.min(...changedBlocks));
  }

  async refreshMetadataBlocks(blocksToRefresh, chainEventsByBlock) {
    if (blocksToRefresh.length === 0) return;

    const canonicalEvents = blocksToRefresh.flatMap((blockNumber) => chainEventsByBlock[blockNumber] || []);
    if (canonicalEvents.length > 0) await StarknetEventService.updateOrCreateMany(canonicalEvents);
  }

  async auditOnce() {
    const logSlug = 'StarknetAuditor::auditOnce';
    const lastAudited = await this.getTrustedCheckpoint();
    const headBlock = Number(await this.retriever.provider.getBlockNumber());
    const finalizedBlock = await this.getFinalizedFrontier();
    const startBlock = Number.isFinite(lastAudited)
      ? Math.max(this.originBlock, lastAudited + 1)
      : this.originBlock;
    logger.info(
      `${logSlug}, finalized frontier head=${headBlock}, l1Accepted=${finalizedBlock}, start=${startBlock}`
    );

    if (startBlock > finalizedBlock) {
      if (!Number.isFinite(lastAudited)) {
        await StarknetBlockCache.setLastAuditedFinalizedBlock(finalizedBlock);
        logger.info(`StarknetAuditor::auditOnce, validated bootstrap checkpoint at block ${finalizedBlock}`);
      }
      logger.info(`${logSlug}, no finalized Starknet blocks pending audit`);
      return {
        headBlock,
        finalizedBlock,
        mismatchedBlocks: 0,
        startBlock,
        endBlock: finalizedBlock
      };
    }

    let mismatchedBlocks = 0;
    let refreshedBlocks = 0;
    await this.retriever.forEachBlockRangeBatch({
      fromBlock: startBlock,
      toBlock: finalizedBlock,
      batchSize: this.batchSize
    }, async ({ fromBlock, toBlock }) => {
      logger.info(`${logSlug}, auditing batch [${fromBlock} -> ${toBlock}]`);
      const chainEvents = await this.retriever.pullAndFormatEvents({ fromBlock, toBlock });
      const storedEvents = await StarknetEventService.getEventsByBlockRange(fromBlock, toBlock);
      const chainEventsByBlock = BaseAuditor.groupEventsByBlock(chainEvents);
      const storedEventsByBlock = BaseAuditor.groupEventsByBlock(storedEvents);
      const changedBlocks = [];
      const metadataBlocks = [];

      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
        const blockChainEvents = chainEventsByBlock[blockNumber] || [];
        const blockStoredEvents = storedEventsByBlock[blockNumber] || [];
        const { identityChanged, metadataChanged } = BaseAuditor.compareBlockEvents({
          chainEvents: blockChainEvents,
          storedEvents: blockStoredEvents,
          metadataKeys: ['status', 'timestamp']
        });

        if (identityChanged) {
          changedBlocks.push(blockNumber);
        } else if (metadataChanged) {
          metadataBlocks.push(blockNumber);
        }
      }

      if (changedBlocks.length > 0) {
        logger.warn(`${logSlug}, repairing ${changedBlocks.length} mismatched block(s)`);
        await this.repairChangedBlocks(changedBlocks, chainEventsByBlock, storedEventsByBlock);
        mismatchedBlocks += changedBlocks.length;
      }

      if (metadataBlocks.length > 0) {
        await this.refreshMetadataBlocks(metadataBlocks, chainEventsByBlock);
        refreshedBlocks += metadataBlocks.length;
      }

      await StarknetBlockCache.setLastAuditedFinalizedBlock(toBlock);
      logger.info(`${logSlug}, advanced finalized audit checkpoint to block ${toBlock}`);
    });

    return {
      headBlock,
      finalizedBlock,
      mismatchedBlocks,
      refreshedBlocks,
      startBlock,
      endBlock: finalizedBlock
    };
  }
}

module.exports = StarknetAuditor;
