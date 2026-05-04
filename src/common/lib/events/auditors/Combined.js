const appConfig = require('config');
const { delay } = require('lodash');
const { Timer } = require('timer-node');
const logger = require('@common/lib/logger');
const EthereumAuditor = require('./ethereum');
const StarknetAuditor = require('./starknet');

class CombinedEventAuditor {
  constructor(props = {}) {
    this.runDelay = Number(props.runDelay || appConfig.EventAuditor?.runDelay || 20000);
    this.ethereumAuditor = props.ethereumAuditor || new EthereumAuditor();
    this.starknetAuditor = props.starknetAuditor || new StarknetAuditor();
  }

  static logAuditResult(logSlug, chain, result = {}) {
    if (!result || result.skipped) return;

    const summary = [
      `head=${result.headBlock}`,
      `finalized=${result.finalizedBlock}`,
      `start=${result.startBlock}`,
      `end=${result.endBlock}`,
      `mismatched=${result.mismatchedBlocks || 0}`
    ];

    if (Number.isFinite(result.refreshedBlocks)) summary.push(`refreshed=${result.refreshedBlocks}`);
    if (Number.isFinite(result.finalizedTimestamp)) summary.push(`finalizedTimestamp=${result.finalizedTimestamp}`);

    logger.info(`${logSlug}, ${chain} result: ${summary.join(', ')}`);
  }

  async runOnce() {
    const results = {};

    try {
      results.ethereum = await this.ethereumAuditor.runIfDue({ force: true });
      CombinedEventAuditor.logAuditResult('CombinedEventAuditor::runOnce', 'ethereum', results.ethereum);
    } catch (error) {
      logger.error('CombinedEventAuditor::runOnce, ethereum audit failed');
      logger.error(error);
      results.ethereum = { error };
    }

    try {
      results.starknet = await this.starknetAuditor.runIfDue({ force: true });
      CombinedEventAuditor.logAuditResult('CombinedEventAuditor::runOnce', 'starknet', results.starknet);
    } catch (error) {
      logger.error('CombinedEventAuditor::runOnce, starknet audit failed');
      logger.error(error);
      results.starknet = { error };
    }

    return results;
  }

  async runner() {
    const keepRunning = true;

    while (keepRunning) {
      const timer = new Timer({ label: 'CombinedEventAuditor-timer' }).start();

      try {
        const result = await this.ethereumAuditor.runIfDue();
        CombinedEventAuditor.logAuditResult('CombinedEventAuditor::runner', 'ethereum', result);
      } catch (error) {
        logger.error('CombinedEventAuditor::runner, ethereum audit failed');
        logger.error(error);
      }

      try {
        const result = await this.starknetAuditor.runIfDue();
        CombinedEventAuditor.logAuditResult('CombinedEventAuditor::runner', 'starknet', result);
      } catch (error) {
        logger.error('CombinedEventAuditor::runner, starknet audit failed');
        logger.error(error);
      }

      if (timer.ms() < this.runDelay) {
        const delayMs = this.runDelay - timer.ms();
        logger.info(`CombinedEventAuditor::runner, delaying for [${delayMs}ms]...`);
        await new Promise((resolve) => {
          delay(resolve, delayMs);
        });
      }
    }
  }
}

module.exports = CombinedEventAuditor;
