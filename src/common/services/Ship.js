const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { Ship } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');
const EntityService = require('./Entity');

const STATIC_CARD_PATH = '../assets/images/ships/cards';
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

class ShipService {
  static getStaticCardFilename(ship) {
    const shipType = Ship.Entity.getType(ship)?.name;
    const variant = Ship.Entity.getVariant(ship)?.name;

    if (!shipType || !variant) throw new Error('Unsupported static ship card');

    return `ship-${slug(shipType)}-${slug(variant)}.png`;
  }

  static async getStaticCard(ship) {
    const filename = ShipService.getStaticCardFilename(ship);
    return fs.readFile(path.join(__dirname, STATIC_CARD_PATH, filename));
  }

  // Returns the NFT metadata card image.
  static async getCard({ entity, ship, ...props }) {
    let _entity = ship;
    if (entity) {
      _entity = await EntityService.getEntity({
        id: entity.id, label: Entity.IDS.SHIP, components: ['Ship'], format: true
      });
    }

    if (props.fileType && props.fileType !== 'png') throw new Error('Ship cards are only available as png');
    return ShipService.getStaticCard(_entity);
  }

  static getCountForAsteroid(asteroidEntity) {
    return mongoose.model('LocationComponent').countDocuments({
      'entity.label': Entity.IDS.SHIP,
      'locations.uuid': Entity.toEntity(asteroidEntity).uuid
    });
  }
}

module.exports = ShipService;
