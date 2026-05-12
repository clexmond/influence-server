const { expect } = require('chai');
const Koa = require('koa');
const request = require('supertest');
const sinon = require('sinon');
const { ActivityService } = require('@common/services');
const { EthereumBlockCache, StarknetBlockCache } = require('@common/lib/cache');
const activityController = require('@api/controllers/activity');

describe('activity controller', function () {
  it('should expose starknet block timestamp headers for tx-hash activity bootstrap requests', async function () {
    const sandbox = sinon.createSandbox();
    const app = new Koa();
    const server = request(app.callback());
    app.use(activityController.routes());

    sandbox.stub(ActivityService, 'find').resolves({ docs: [{ id: 'activity-1' }] });
    sandbox.stub(EthereumBlockCache, 'getCurrentBlockNumber').resolves(25021764);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockTimestamp').resolves(1778144596);

    const response = await server
      .get('/v2/activity?txHash=0xabc')
      .set('Origin', 'http://localhost.local');

    expect(response.status).to.equal(200);
    expect(response.headers['eth-block-number']).to.equal('25021764');
    expect(response.headers['starknet-block-number']).to.equal('9542288');
    expect(response.headers['starknet-block-timestamp']).to.equal('1778144596');
    expect(response.headers['access-control-expose-headers']).to.include('Starknet-Block-Timestamp');
    expect(response.body).to.deep.equal([{ id: 'activity-1' }]);
    sandbox.restore();
  });
});
