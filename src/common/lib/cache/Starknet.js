const BaseMongoCache = require('./Base');

class StarknetBlockCache extends BaseMongoCache {
  static reset() {
    const cache = this.cacheInstance;

    return Promise.all([
      cache.delete('LAST_RETRIEVED_STARKNET_BLOCK'),
      cache.delete('LAST_AUDITED_FINALIZED_STARKNET_BLOCK')
    ]);
  }

  static getLastRetrievedBlock() {
    return this.cacheInstance.get('LAST_RETRIEVED_STARKNET_BLOCK');
  }

  static setLastRetrievedBlock(blockNumber) {
    return this.cacheInstance.set('LAST_RETRIEVED_STARKNET_BLOCK', blockNumber);
  }

  static setCurrentBlockNumber(blockNumber) {
    return this.cacheInstance.set('CURRENT_STARKNET_BLOCK_NUMBER', blockNumber);
  }

  static getCurrentBlockNumber() {
    return this.cacheInstance.get('CURRENT_STARKNET_BLOCK_NUMBER');
  }

  static setCurrentBlockTimestamp(blockTimestamp) {
    return this.cacheInstance.set('CURRENT_STARKNET_BLOCK_TIMESTAMP', blockTimestamp);
  }

  static getCurrentBlockTimestamp() {
    return this.cacheInstance.get('CURRENT_STARKNET_BLOCK_TIMESTAMP');
  }

  static setLastEmittedCurrentBlockNumber(blockNumber) {
    return this.cacheInstance.set('LAST_EMITTED_CURRENT_STARKNET_BLOCK_NUMBER', blockNumber);
  }

  static getLastEmittedCurrentBlockNumber() {
    return this.cacheInstance.get('LAST_EMITTED_CURRENT_STARKNET_BLOCK_NUMBER');
  }

  static getLastAuditedFinalizedBlock() {
    return this.cacheInstance.get('LAST_AUDITED_FINALIZED_STARKNET_BLOCK');
  }

  static setLastAuditedFinalizedBlock(blockNumber) {
    return this.cacheInstance.set('LAST_AUDITED_FINALIZED_STARKNET_BLOCK', blockNumber);
  }

  static getLegacyAcceptedL1Block() {
    return this.cacheInstance.get('ACCEPTED_L1_BLOCK');
  }
}

module.exports = StarknetBlockCache;
