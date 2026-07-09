const fs = require('fs/promises');
const mongoose = require('mongoose');
const path = require('path');
const { get, isNil, isNumber } = require('lodash');
const { Address } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');

const STATIC_CARD_PATH = path.resolve(__dirname, '../assets/images/crews/cards');

class CrewService {
  // Returns the NFT metadata card image.
  static async getCard({ fileType }) {
    if (fileType !== 'png') throw new Error('Crew cards are only available as png');
    return fs.readFile(path.join(STATIC_CARD_PATH, 'crew.png'));
  }

  static async findStation(crew, { lean = true } = {}) {
    const crewEntity = (isNumber(crew)) ? Entity.Crew(crew) : Entity.toEntity(crew);

    // get the full location for the specified crew
    const locationComponentDoc = await mongoose.model('LocationComponent').findOne({ 'entity.uuid': crewEntity.uuid });
    if (!locationComponentDoc) throw new Error('Unable to find location for crew');

    return mongoose.model('StationComponent').findOne({ 'entity.uuid': locationComponentDoc.location.uuid }).lean(lean);
  }

  static getCountForAsteroid(asteroidEntity) {
    return mongoose.model('LocationComponent').countDocuments({
      'entity.label': Entity.IDS.CREW,
      'locations.uuid': Entity.toEntity(asteroidEntity).uuid
    });
  }

  static getCrewForCrewmate(crewmateEntity, { lean = true } = {}) {
    return mongoose.model('CrewComponent').findOne({ roster: crewmateEntity.id }).lean(lean);
  }

  static async isCaptain(crew, crewmate) {
    if (!crew) throw Error('crew entity or crew component doc required');
    if (!crewmate) throw Error('crewmate entity or crewmate component doc required');

    let _crewComponentDoc = crew;
    const crewmateEntity = Entity.toEntity(crewmate);

    if (!crew.roster) {
      _crewComponentDoc = await mongoose.mongoose.model('CrewComponent').findOne({ 'entity.id': crew.id }).lean();
    }

    return (get(_crewComponentDoc, 'roster[0]') === crewmateEntity.id);
  }

  static async isDelegatedTo({ crew, address } = {}) {
    if (!crew) throw Error('crew required');
    if (!address) throw Error('address required');

    const crewEntity = Entity.toEntity(crew);
    const result = await mongoose.model('CrewComponent').exists({
      'entity.uuid': crewEntity.uuid,
      delegatedTo: Address.toStandard(address)
    });

    return !isNil(result);
  }
}

module.exports = CrewService;
