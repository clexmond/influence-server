const { expect } = require('chai');
const { AsteroidService } = require('@common/services');

describe('AsteroidService', function () {
  describe('getStaticCardFilename', function () {
    it('should select an asteroid card by spectral type and size', function () {
      const asteroidDoc = {
        Celestial: {
          abundances: '0x7f0a4bd0c8141280000000001f3',
          bonuses: 0,
          celestialType: 1,
          mass: 1329730329406897600000000000,
          purchaseOrder: 1,
          radius: 375.1419399997685,
          scanFinishTime: 0,
          scanStatus: 4
        }
      };

      expect(AsteroidService.getStaticCardFilename(asteroidDoc)).to.equal('asteroid-c-huge.png');
    });
  });
});
