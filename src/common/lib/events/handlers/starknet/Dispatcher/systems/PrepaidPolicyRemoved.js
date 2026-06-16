const { Address, Permission } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');
const { ActivityService, ElasticSearchService, PackedLotDataService } = require('@common/services');
const StarknetBaseHandler = require('../../Handler');

class Handler extends StarknetBaseHandler {
  static eventConfig = {
    keys: ['0xd513ef8bb6ec70b2429eb7621d1985bde43e6deaee591e8ed3600a5156b2c2'],
    name: 'PrepaidPolicyRemoved'
  };

  async processEvent() {
    const { returnValues: { entity, permission, callerCrew, caller } } = this.eventDoc;

    const activityResult = await ActivityService.findOrCreateOne({
      addresses: [caller],
      entities: [entity, callerCrew],
      event: this.eventDoc
    });

    if (activityResult?.created === 0) return;

    await ElasticSearchService.queueEntityForIndexing(entity);
    if (permission === Permission.IDS.USE_LOT && Entity.isAsteroid(entity)) {
      await PackedLotDataService.updateLotsToNonLeaseable({ asteroidEntity: entity });
    }

    this.messages.push({ to: `Crew::${callerCrew.id}` });
  }

  static transformEventData(event) {
    const data = [...event.data];
    return {
      entity: this._entityFromData(data),
      permission: Number(data.shift()),
      callerCrew: this._entityFromData(data),
      caller: Address.toStandard(data.shift(), 'starknet')
    };
  }
}

module.exports = Handler;
