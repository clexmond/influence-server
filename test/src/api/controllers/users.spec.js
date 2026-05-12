const { expect } = require('chai');
const Koa = require('koa');
const request = require('supertest');
const sinon = require('sinon');
const { ActivityService, UserService } = require('@common/services');
const { EthereumBlockCache, StarknetBlockCache } = require('@common/lib/cache');
const usersController = require('@api/controllers/users');

describe('users controller', function () {
  it('should expose starknet block bootstrap headers on the authenticated user profile response', async function () {
    const sandbox = sinon.createSandbox();
    const app = new Koa();
    const server = request(app.callback());
    const { userToken } = this.GLOBALS;
    app.use(usersController.routes());

    sandbox.stub(UserService, 'findByAddress').resolves({
      address: '0xuser',
      toJSON: () => ({ id: 'user-id', address: '0xuser', watchlist: [] })
    });
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockTimestamp').resolves(1778144596);

    const response = await server
      .get('/v2/user')
      .set('Origin', 'http://localhost.local')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).to.equal(200);
    expect(response.headers['starknet-block-number']).to.equal('9542288');
    expect(response.headers['starknet-block-timestamp']).to.equal('1778144596');
    expect(response.headers['access-control-expose-headers']).to.include('Starknet-Block-Timestamp');
    expect(response.body).to.deep.equal({ address: '0xuser', watchlist: [] });
    sandbox.restore();
  });

  it('should expose starknet block timestamp headers for authenticated user activity responses', async function () {
    const sandbox = sinon.createSandbox();
    const app = new Koa();
    const server = request(app.callback());
    const { userToken } = this.GLOBALS;
    app.use(usersController.routes());

    sandbox.stub(UserService, 'findByAddress').resolves({ address: '0xuser' });
    sandbox.stub(ActivityService, 'findByAddressAndCrew').resolves({
      docs: [{
        toJSON: () => ({ id: 'activity-1' }),
        isHiddenBy: () => false
      }],
      totalCount: 1
    });
    sandbox.stub(EthereumBlockCache, 'getCurrentBlockNumber').resolves(25021764);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockTimestamp').resolves(1778144596);

    const response = await server
      .get('/v2/user/activity?crewId=1')
      .set('Origin', 'http://localhost.local')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).to.equal(200);
    expect(response.headers['eth-block-number']).to.equal('25021764');
    expect(response.headers['starknet-block-number']).to.equal('9542288');
    expect(response.headers['starknet-block-timestamp']).to.equal('1778144596');
    expect(response.headers['total-hits']).to.equal('1');
    expect(response.headers['access-control-expose-headers']).to.include('Starknet-Block-Timestamp');
    expect(response.body).to.deep.equal([{ id: 'activity-1', isHidden: false }]);
    sandbox.restore();
  });

  it('should omit the starknet block timestamp header when the cached timestamp is unavailable', async function () {
    const sandbox = sinon.createSandbox();
    const app = new Koa();
    const server = request(app.callback());
    const { userToken } = this.GLOBALS;
    app.use(usersController.routes());

    sandbox.stub(UserService, 'findByAddress').resolves({
      address: '0xuser',
      toJSON: () => ({ id: 'user-id', address: '0xuser' })
    });
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockNumber').resolves(9542288);
    sandbox.stub(StarknetBlockCache, 'getCurrentBlockTimestamp').resolves(null);

    const response = await server
      .get('/v2/user')
      .set('Origin', 'http://localhost.local')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).to.equal(200);
    expect(response.headers['starknet-block-number']).to.equal('9542288');
    expect(response.headers).to.not.have.property('starknet-block-timestamp');
    sandbox.restore();
  });
});
