const fs = require('fs/promises');
const path = require('path');
const { Asteroid, Entity } = require('@influenceth/sdk');
const EntityService = require('./Entity');

const STATIC_CARD_PATH = '../assets/images/asteroids/cards';
const slug = (value) => value.toLowerCase();

class AsteroidService {
  static getStaticCardFilename(asteroidDoc) {
    const spectralType = Asteroid.Entity.getSpectralType(asteroidDoc);
    const size = Asteroid.Entity.getSize(asteroidDoc);

    if (!spectralType || !size) throw new Error('Unsupported static asteroid card');

    return `asteroid-${slug(spectralType)}-${slug(size)}.png`;
  }

  static async getStaticCard(asteroidDoc) {
    const filename = AsteroidService.getStaticCardFilename(asteroidDoc);
    return fs.readFile(path.join(__dirname, STATIC_CARD_PATH, filename));
  }

  // Returns the NFT metadata card image.
  static async getCard({ asteroidDoc, entity, ...props }) {
    let _entity = asteroidDoc;
    if (entity) {
      _entity = await EntityService.getEntity({
        id: entity.id, label: Entity.IDS.ASTEROID, components: ['Celestial'], format: true
      });
    }

    if (props.fileType && props.fileType !== 'png') throw new Error('Asteroid cards are only available as png');
    return AsteroidService.getStaticCard(_entity);
  }
}

module.exports = AsteroidService;
