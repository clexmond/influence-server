const { expect } = require('chai');
const mongoose = require('mongoose');
const { Entity } = require('@influenceth/sdk');
const { CrewmateService } = require('@common/services');

describe('CrewmateService', function () {
  beforeEach(async function () {
    await Promise.all([
      mongoose.model('CrewComponent').create([
        { entity: { id: 1, label: Entity.IDS.CREW }, roster: [1, 2, 3] },
        { entity: { id: 2, label: Entity.IDS.CREW }, roster: [4, 5, 6, 7, 8] }
      ]),
      mongoose.model('CrewmateComponent').create([
        { entity: { id: 1, label: Entity.IDS.CREWMATE } },
        { entity: { id: 2, label: Entity.IDS.CREWMATE } },
        { entity: { id: 3, label: Entity.IDS.CREWMATE } },
        { entity: { id: 4, label: Entity.IDS.CREWMATE } }
      ])
    ]);
  });

  afterEach(function () {
    return this.utils.resetCollections(['CrewComponent', 'CrewmateComponent']);
  });

  describe('findByCrew', function () {
    it('should return the crewmate component docs for the specified crew', async function () {
      let result = await CrewmateService.findByCrew({ id: 1, label: Entity.IDS.CREW });
      expect(result.length).to.equal(3);

      result = await CrewmateService.findByCrew(1);
      expect(result.length).to.equal(3);
    });
  });

  describe('getStaticCardFilename', function () {
    it('should select a collection and class card for standard crewmates', function () {
      const filename = CrewmateService.getStaticCardFilename({
        Crewmate: { coll: 2, class: 2 }
      });

      expect(filename).to.equal('arvad-citizen-engineer.png');
    });

    it('should select the recruit card for uncreated crewmates', function () {
      const filename = CrewmateService.getStaticCardFilename({});

      expect(filename).to.equal('adalian-recruit.png');
    });

    it('should select a title-specific card for Arvad Leadership crewmates', function () {
      const filename = CrewmateService.getStaticCardFilename({
        Crewmate: { coll: 3, title: 60 }
      });

      expect(filename).to.equal('arvad-leadership-chief-technology-officer.png');
    });
  });
});
