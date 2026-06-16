const { expect } = require('chai');
const mongoose = require('mongoose');
const Handler = require('@common/lib/events/handlers/starknet/Dispatcher/systems/agreements/PrepaidAgreementAuctionStarted');

describe('PrepaidAgreementAuctionStarted Handler', function () {
  let event;

  before(function () {
    event = mongoose.model('Starknet')({
      event: 'PrepaidAgreementAuctionStarted',
      logIndex: 1,
      timestamp: 1695691834,
      transactionIndex: 1,
      transactionHash: '0x123456789',
      data: [
        '0x4', '0x100000001',
        '0x651af72e',
        '0x1', '0x1',
        '0x123456789'
      ],
      returnValues: {
        lot: { id: 4294967297, label: 4 },
        startTime: 1696266030,
        callerCrew: { id: 1, label: 1 },
        caller: '0x0000000000000000000000000000000000000000000000000000000123456789'
      }
    });
  });

  afterEach(function () {
    return this.utils.resetCollections(['Activity', 'Entity']);
  });

  describe('transformEventData', function () {
    it('should transform the data correctly', function () {
      expect(Handler.transformEventData(event)).to.deep.equal(event.returnValues);
    });
  });
});
