const { expect } = require('chai');
const mongoose = require('mongoose');
const { BRIDGING_STATES } = require('@common/constants');
const CrossingService = require('@common/services/Crossing');

describe('CrossingService', function () {
  afterEach(function () {
    return this.utils.resetCollections(['Crossing']);
  });

  describe('find', function () {
    beforeEach(async function () {
      await mongoose.model('Crossing').create([
        {
          assetIds: [1],
          assetType: 'Asteroid',
          destination: 'ETHEREUM',
          origin: 'STARKNET',
          status: BRIDGING_STATES.PROCESSING
        },
        {
          assetIds: [2],
          assetType: 'Crew',
          destination: 'STARKNET',
          origin: 'ETHEREUM',
          status: BRIDGING_STATES.COMPLETE
        },
        {
          assetIds: [3],
          assetType: 'Ship',
          destination: 'STARKNET',
          origin: 'ETHEREUM',
          status: BRIDGING_STATES.PROCESSING
        }
      ]);
    });

    it('should filter by assetTypes string', async function () {
      const crossings = await CrossingService.find({ assetTypes: 'Asteroid' });

      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].assetType).to.equal('Asteroid');
    });

    it('should filter by assetTypes array', async function () {
      const crossings = await CrossingService.find({ assetTypes: ['Asteroid', 'Ship'] });

      expect(crossings.map((crossing) => crossing.assetType)).to.have.members(['Asteroid', 'Ship']);
    });

    it('should filter by status string', async function () {
      const crossings = await CrossingService.find({ status: BRIDGING_STATES.COMPLETE });

      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].status).to.equal(BRIDGING_STATES.COMPLETE);
    });
  });

  describe('removeAsteroidCrossing', function () {
    it('should remove the correct asteroid crossing document', async function () {
      await mongoose.model('Crossing').create([
        { assetIds: [1, 2], assetType: 'Asteroid', destination: 'ETHEREUM', origin: 'STARKNET' },
        { assetIds: [1, 2], assetType: 'Crewmate', destination: 'STARKNET', origin: 'ETHEREUM' },
        { assetIds: [5, 6, 7], assetType: 'Asteroid', destination: 'STARKNET', origin: 'ETHEREUM' }
      ]);

      await CrossingService.removeAsteroidCrossing(1, 'ETHEREUM', 'STARKNET');
      let remainingCrossings = await mongoose.model('Crossing').find({});
      const crossings = await mongoose.model('Crossing').find({ assetIds: { $in: [1] }, assetType: 'Asteroid' });

      expect(remainingCrossings).to.have.lengthOf(3);
      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].origin).to.equal('STARKNET');

      await CrossingService.removeAsteroidCrossing([1, 2], 'STARKNET', 'ETHEREUM');
      remainingCrossings = await mongoose.model('Crossing').find({});
      expect(remainingCrossings).to.have.lengthOf(2);
    });
  });

  describe('removeCrewCrossing', function () {
    it('should remove the correct crew crossing document', async function () {
      await mongoose.model('Crossing').create([
        { assetIds: [1, 2], assetType: 'Crew', destination: 'ETHEREUM', origin: 'STARKNET' },
        { assetIds: [1, 2], assetType: 'Asteroid', destination: 'STARKNET', origin: 'ETHEREUM' },
        { assetIds: [5, 6, 7], assetType: 'Crew', destination: 'STARKNET', origin: 'ETHEREUM' }
      ]);

      await CrossingService.removeCrewCrossing(1, 'ETHEREUM', 'STARKNET');
      let remainingCrossings = await mongoose.model('Crossing').find({});
      const crossings = await mongoose.model('Crossing').find({ assetIds: { $in: [1] }, assetType: 'Crew' });

      expect(remainingCrossings).to.have.lengthOf(3);
      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].origin).to.equal('STARKNET');

      await CrossingService.removeCrewCrossing([1, 2], 'STARKNET', 'ETHEREUM');
      remainingCrossings = await mongoose.model('Crossing').find({});
      expect(remainingCrossings).to.have.lengthOf(2);
    });
  });

  describe('removeCrewmateCrossing', function () {
    it('should remove the correct crewmate crossing document', async function () {
      await mongoose.model('Crossing').create([
        { assetIds: [1, 2], assetType: 'Crewmate', destination: 'ETHEREUM', origin: 'STARKNET' },
        { assetIds: [1, 2], assetType: 'Asteroid', destination: 'STARKNET', origin: 'ETHEREUM' },
        { assetIds: [5, 6, 7], assetType: 'Crewmate', destination: 'STARKNET', origin: 'ETHEREUM' }
      ]);

      await CrossingService.removeCrewmateCrossing(1, 'ETHEREUM', 'STARKNET');
      let remainingCrossings = await mongoose.model('Crossing').find({});
      const crossings = await mongoose.model('Crossing').find({ assetIds: { $in: [1] }, assetType: 'Crewmate' });

      expect(remainingCrossings).to.have.lengthOf(3);
      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].origin).to.equal('STARKNET');

      await CrossingService.removeCrewmateCrossing([1, 2], 'STARKNET', 'ETHEREUM');
      remainingCrossings = await mongoose.model('Crossing').find({});
      expect(remainingCrossings).to.have.lengthOf(2);
    });
  });

  describe('removeShipCrossing', function () {
    it('should remove the correct ship crossing document', async function () {
      await mongoose.model('Crossing').create([
        { assetIds: [1, 2], assetType: 'Ship', destination: 'ETHEREUM', origin: 'STARKNET' },
        { assetIds: [1, 2], assetType: 'Asteroid', destination: 'STARKNET', origin: 'ETHEREUM' },
        { assetIds: [5, 6, 7], assetType: 'Ship', destination: 'STARKNET', origin: 'ETHEREUM' }
      ]);

      await CrossingService.removeShipCrossing(1, 'ETHEREUM', 'STARKNET');
      let remainingCrossings = await mongoose.model('Crossing').find({});
      const crossings = await mongoose.model('Crossing').find({ assetIds: { $in: [1] }, assetType: 'Ship' });

      expect(remainingCrossings).to.have.lengthOf(3);
      expect(crossings).to.have.lengthOf(1);
      expect(crossings[0].origin).to.equal('STARKNET');

      await CrossingService.removeShipCrossing([1, 2], 'STARKNET', 'ETHEREUM');
      remainingCrossings = await mongoose.model('Crossing').find({});
      expect(remainingCrossings).to.have.lengthOf(2);
    });
  });
});
