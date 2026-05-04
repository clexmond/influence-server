const { groupBy } = require('lodash');

class BaseAuditor {
  constructor({ name, runDelay } = {}) {
    this.name = name || this.constructor.name;
    this.runDelay = Number(runDelay || 0);
    this.lastRunAt = 0;
  }

  static getStableEventKey(event) {
    return [
      event.event,
      event.transactionHash,
      event.logIndex
    ].join(':');
  }

  static groupEventsByBlock(events = []) {
    return groupBy(events, 'blockNumber');
  }

  static compareBlockEvents({ chainEvents = [], storedEvents = [], metadataKeys = [] }) {
    if (chainEvents.length !== storedEvents.length) {
      return { identityChanged: true, metadataChanged: false };
    }

    const chainByKey = new Map(chainEvents.map((event) => [this.getStableEventKey(event), event]));
    const storedByKey = new Map(storedEvents.map((event) => [this.getStableEventKey(event), event]));

    for (const [key, chainEvent] of chainByKey.entries()) {
      const storedEvent = storedByKey.get(key);
      if (!storedEvent) return { identityChanged: true, metadataChanged: false };
      if (storedEvent.blockHash !== chainEvent.blockHash) {
        return { identityChanged: true, metadataChanged: false };
      }
    }

    const metadataChanged = metadataKeys.some((metadataKey) => storedEvents.some((storedEvent) => {
      const chainEvent = chainByKey.get(this.getStableEventKey(storedEvent));
      return String(storedEvent?.[metadataKey]) !== String(chainEvent?.[metadataKey]);
    }));

    return { identityChanged: false, metadataChanged };
  }

  shouldRun(now = Date.now()) {
    if (!this.runDelay) return true;
    return !this.lastRunAt || (now - this.lastRunAt) >= this.runDelay;
  }

  async runIfDue({ force = false, ...context } = {}) {
    if (!force && !this.shouldRun()) return { skipped: true };

    const result = await this.auditOnce(context);
    this.lastRunAt = Date.now();
    return { skipped: false, ...result };
  }
}

module.exports = BaseAuditor;
