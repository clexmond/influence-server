/* eslint-disable max-classes-per-file */
const { expect } = require('chai');
const EthereumEventConfig = require('@common/lib/events/retrievers/ethereum/config');
const handlers = require('@common/lib/events/handlers/ethereum/AsteroidToken');

describe('Ethereum Event Config', function () {
  const ADDRESS_NAME_MAP = {
    '0x123': {
      name: 'AsteroidToken',
      handlers
    }
  };

  describe('get config', function () {
    it('should build the config if not already built', function () {
      const { config } = EthereumEventConfig;
      expect(config).to.be.a('object');
      expect(EthereumEventConfig._eventsConfig).to.be.a('object');
    });
  });

  describe('buildEventsConfig', function () {
    it('should build and set the _eventsConfig property', function () {
      EthereumEventConfig.buildEventsConfig(ADDRESS_NAME_MAP);
      const address = '0x0000000000000000000000000000000000000123';
      expect(EthereumEventConfig._eventsConfig[address]).to.have.all.keys(
        'abi',
        'address',
        'contract',
        'eventTopicMap',
        'eventTopics',
        'handlers'
      );
      expect(EthereumEventConfig._eventsConfig[address].handlers).to.have.all.keys('Transfer');
      expect(EthereumEventConfig._eventsConfig[address].contract).to.be.an('object');
      expect(EthereumEventConfig._eventsConfig[address].eventTopics).to.have.lengthOf(1);
    });
  });

  describe('getHandler', function () {
    it('should return a handler for a given event', function () {
      EthereumEventConfig.buildEventsConfig(ADDRESS_NAME_MAP);
      const event = {
        from_address: '0x123',
        event: 'Transfer'
      };
      const handler = EthereumEventConfig.getHandler(event);
      expect(handler).to.be.an('function');
    });
  });

  describe('matchesEventFilter', function () {
    it('should match ethereum address filters regardless of checksum casing', function () {
      const matches = EthereumEventConfig.matchesEventFilter({
        returnValues: {
          toAddress: '0xe4A4a70b9793220746e414ECf54CF9fbbF16ebFb'
        }
      }, {
        toAddress: ['0xe4a4a70b9793220746e414ecf54cf9fbbf16ebfb']
      });

      expect(matches).to.equal(true);
    });

    it('should not normalize non-address filter values', function () {
      const matches = EthereumEventConfig.matchesEventFilter({
        returnValues: {
          fromAddress: '0x30058f19ed447208015f6430f0102e8ab82d6c291566d7e73fe8e613c3d2ed'
        }
      }, {
        fromAddress: ['0x0030058f19ed447208015f6430f0102e8ab82d6c291566d7e73fe8e613c3d2ed']
      });

      expect(matches).to.equal(false);
    });
  });
});
