const { ComponentService, ElasticSearchService } = require('@common/services');
const BaseHandler = require('../../Handler');

class Handler extends BaseHandler {
  static eventConfig = {
    keys: [
      '0x297be67eb977068ccd2304c6440368d4a6114929aeb860c98b6a7e91f96e2ef',
      '0x53686970'
    ],
    name: 'ComponentUpdated_Ship'
  };

  async processEvent() {
    const { returnValues: { entity } } = this.eventDoc;

    const { updated } = await ComponentService.updateOrCreateFromEvent({
      component: 'Ship',
      event: this.eventDoc,
      data: { ...this.eventDoc.returnValues },
      replace: true
    });

    if (!updated) return;
    await ElasticSearchService.queueEntityForIndexing(entity);
  }

  static transformEventData(event) {
    const data = event.data.slice(1);
    return {
      entity: this._entityFromUuid(data.shift()),
      shipType: Number(data.shift()),
      status: Number(data.shift()),
      readyAt: Number(data.shift()),
      variant: Number(data.shift()),
      emergencyAt: Number(data.shift()),
      transitOrigin: this._entityFromData(data),
      transitDeparture: Number(data.shift()),
      transitDestination: this._entityFromData(data),
      transitArrival: Number(data.shift())
    };
  }
}

module.exports = Handler;
