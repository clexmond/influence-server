const { expect } = require('chai');
const appConfig = require('config');
const axios = require('axios');
const Marketplaces = require('@common/lib/marketplaces');
const Element = require('@common/lib/marketplaces/Element');

const { OpenSea } = Marketplaces;

describe('Element marketplace', function () {
  let configState;

  beforeEach(function () {
    configState = appConfig.util.cloneDeep(appConfig);
    appConfig.Element = {
      uri: 'https://api.element.market/openapi/v1',
      chain: 'starknet'
    };
    appConfig.Contracts.starknet = {
      asteroid: '0x1',
      crew: '0x2',
      crewmate: '0x3'
    };
  });

  afterEach(function () {
    Object.keys(appConfig).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(configState, key)) delete appConfig[key];
    });
    Object.assign(appConfig, configState);
  });

  it('refreshes asteroid metadata on Element', async function () {
    const getStub = this._sandbox.stub(axios, 'get').resolves({ status: 200 });

    await Element.updateAsteroidAsset({ id: 1 });

    expect(getStub.calledOnceWithExactly(
      'https://api.element.market/openapi/v1/asset/refreshMeta?chain=starknet&contract_address=0x1&token_id=1'
    )).to.equal(true);
  });

  it('refreshes crew and crewmate metadata on Element', async function () {
    const getStub = this._sandbox.stub(axios, 'get').resolves({ status: 200 });

    await Element.updateCrewmateAsset({ id: 1 });

    expect(getStub.getCall(0).args[0]).to.equal(
      'https://api.element.market/openapi/v1/asset/refreshMeta?chain=starknet&contract_address=0x2&token_id=1'
    );
    expect(getStub.getCall(1).args[0]).to.equal(
      'https://api.element.market/openapi/v1/asset/refreshMeta?chain=starknet&contract_address=0x3&token_id=1'
    );
  });

  it('includes Element in asteroid refreshes when configured', async function () {
    const openSeaStub = this._sandbox.stub(OpenSea, 'updateAsteroidAsset').resolves();
    const elementStub = this._sandbox.stub(Element, 'updateAsteroidAsset').resolves();

    await Marketplaces.updateAsteroidAsset({ id: 1 });

    expect(openSeaStub.calledOnceWithExactly({ id: 1 })).to.equal(true);
    expect(elementStub.calledOnceWithExactly({ id: 1 })).to.equal(true);
  });

  it('includes Element in crewmate refreshes when configured', async function () {
    const openSeaStub = this._sandbox.stub(OpenSea, 'updateCrewmateAsset').resolves();
    const elementStub = this._sandbox.stub(Element, 'updateCrewmateAsset').resolves();

    await Marketplaces.updateCrewmateAsset({ id: 1 });

    expect(openSeaStub.calledOnceWithExactly({ id: 1 })).to.equal(true);
    expect(elementStub.calledOnceWithExactly({ id: 1 })).to.equal(true);
  });
});
