const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { isNumber } = require('lodash');
const { Crewmate } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');
const EntityService = require('./Entity');

const STATIC_CARD_PATH = '../assets/images/crewmates/cards';
const STATIC_CARD_COLLECTIONS = {
  1: 'arvad-specialist',
  2: 'arvad-citizen',
  4: 'adalian'
};
const STATIC_CARD_CLASSES = {
  1: 'pilot',
  2: 'engineer',
  3: 'miner',
  4: 'merchant',
  5: 'scientist'
};

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

class CrewmateService {
  static getStaticCardFilename(crewmateDoc) {
    const { coll: collection, class: crewClass, title } = crewmateDoc.Crewmate || {};

    if (!collection) return 'adalian-recruit.png';

    if (collection === 3) {
      if (!title) throw new Error('Arvad Leadership crewmate is missing title');
      return `arvad-leadership-${slug(Crewmate.getTitle(title).name)}.png`;
    }

    const collectionSlug = STATIC_CARD_COLLECTIONS[collection];
    const classSlug = STATIC_CARD_CLASSES[crewClass];

    if (!collectionSlug || !classSlug) {
      throw new Error(`Unsupported static crewmate card: collection ${collection}, class ${crewClass}`);
    }

    return `${collectionSlug}-${classSlug}.png`;
  }

  static async getStaticCard(crewmateDoc) {
    const filename = CrewmateService.getStaticCardFilename(crewmateDoc);
    return fs.readFile(path.join(__dirname, STATIC_CARD_PATH, filename));
  }

  // Returns the NFT metadata card image.
  static async getCard({ crewmateDoc, entity, ...props }) {
    let _entity = crewmateDoc;
    if (entity) {
      _entity = await EntityService.getEntity({
        id: entity.id, label: Entity.IDS.CREWMATE, components: ['Crewmate'], format: true
      });
    }

    if (props.fileType && props.fileType !== 'png') throw new Error('Crewmate cards are only available as png');
    if (props.options?.bustOnly) throw new Error('Crewmate bust-only images are no longer supported');
    return CrewmateService.getStaticCard(_entity);
  }

  /**
   * Get the crewmate's full location via the crew's location
   *
   * @param {id: {Number}, label: {Number}} entity
   */
  static async getFullLocation(id) {
    // get the crew for the entity
    const crewComponentDoc = await mongoose.model('CrewComponent').findOne({ roster: { $in: [id] } }).lean();
    if (!crewComponentDoc) return null;

    // get the crew's full location
    const locationDoc = await mongoose.model('LocationComponent').findOne({
      'entity.uuid': crewComponentDoc.entity.uuid
    });
    return (locationDoc) ? locationDoc.locations : null;
  }

  static async findByCrew(crew, { components = ['Crewmate'] } = {}, format = true) {
    const crewEntity = (isNumber(crew)) ? Entity.Crew(crew) : Entity.toEntity(crew);
    const crewComponentDoc = await mongoose.model('CrewComponent').findOne({ 'entity.uuid': crewEntity.uuid }).lean();
    if (!crewComponentDoc || crewComponentDoc.roster.length === 0) return [];
    return EntityService.getEntities({ id: crewComponentDoc.roster, label: Entity.IDS.CREWMATE, components, format });
  }
}

module.exports = CrewmateService;
