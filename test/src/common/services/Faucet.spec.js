const { expect } = require('chai');
const appConfig = require('config');
const mongoose = require('mongoose');
const FaucetService = require('@common/services/Faucet');
const starknetClient = require('@common/lib/starknet/client');

describe('FaucetService', function () {
  let configState;

  before(function () {
    configState = appConfig.util.cloneDeep(appConfig);
  });

  beforeEach(function () {
    appConfig.Contracts = appConfig.Contracts || {};
    appConfig.Contracts.starknet = {
      ...(appConfig.Contracts.starknet || {}),
      ether: '0x111',
      sway: '0x222',
      faucet: '0x333'
    };
    appConfig.Starknet = {
      ...(appConfig.Starknet || {}),
      faucetPrivateKey: '0xabc123',
      rpcProvider: 'http://starknet.local'
    };
  });

  after(function () {
    Object.assign(appConfig, configState);
  });

  afterEach(async function () {
    await this.utils.resetCollections(['Faucet']);
  });

  describe('recordClaim', function () {
    it('should reject unsupported tokens', async function () {
      let error;
      try {
        await FaucetService.recordClaim({
          recipient: this.GLOBALS.TEST_STARKNET_WALLET,
          token: 'USDC'
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error');
      expect(error.message).to.equal('Unsupported token');
    });

    it('should reject claims that are too recent before touching Starknet', async function () {
      await mongoose.model('Faucet').create({
        recipient: this.GLOBALS.TEST_STARKNET_WALLET,
        token: 'ETH',
        lastClaimed: new Date(),
        totalClaimed: 0.015
      });

      const providerStub = this._sandbox.stub(starknetClient, 'createRpcProvider');

      let error;
      try {
        await FaucetService.recordClaim({
          recipient: this.GLOBALS.TEST_STARKNET_WALLET,
          token: 'ETH'
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error');
      expect(error.message).to.equal('Last claim is too recent');
      expect(providerStub.called).to.equal(false);
    });

    it('should create a faucet record and submit an on-chain transfer', async function () {
      const provider = { provider: true };
      const account = { account: true };
      const contract = {
        transfer: this._sandbox.stub().resolves({ transaction_hash: '0xabc' })
      };

      this._sandbox.stub(starknetClient, 'createRpcProvider').resolves(provider);
      this._sandbox.stub(starknetClient, 'createAccount').returns(account);
      this._sandbox.stub(starknetClient, 'createContract').returns(contract);

      const txHash = await FaucetService.recordClaim({
        recipient: this.GLOBALS.TEST_STARKNET_WALLET,
        token: 'SWAY'
      });

      const doc = await mongoose.model('Faucet').findOne({
        recipient: this.GLOBALS.TEST_STARKNET_WALLET,
        token: 'SWAY'
      });

      expect(txHash).to.equal('0xabc');
      expect(contract.transfer.calledOnce).to.equal(true);
      expect(contract.transfer.firstCall.args[0]).to.equal(this.GLOBALS.TEST_STARKNET_WALLET);
      expect(contract.transfer.firstCall.args[1]).to.be.an('object');
      expect(doc).to.not.equal(null);
      expect(doc.totalClaimed).to.equal(400000);
      expect(doc.lastClaimed).to.be.instanceOf(Date);
    });
  });
});
