const { Entity } = require('@influenceth/sdk');
const router = require('@koa/router')();
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const ratelimit = require('koa-ratelimit');
const { isWhiteList } = require('@api/plugins/origin');
const { AsteroidService, CrewService, CrewmateService, EntityService, ShipService } = require('@common/services');

const VALID_FILE_TYPES = {
  png: 'image/png'
};

// Returns the static card for any minted asteroid.
const getAsteroidCard = async (ctx) => {
  const { params: { i: tokenId, fileType } } = ctx;
  if (fileType !== 'png') ctx.throw(400, 'Asteroid cards are only available as png');

  const asteroid = await EntityService.getEntity({
    id: tokenId, label: Entity.IDS.ASTEROID, components: ['Celestial'], format: true
  });

  if (!asteroid) ctx.throw(404, `No asteroid with id ${ctx.params.i} found`);

  const card = await AsteroidService.getCard({ asteroidDoc: asteroid, fileType });
  ctx.type = VALID_FILE_TYPES[fileType];
  ctx.body = card;
};

// Returns the static card for each crewmate.
const getCrewmateCard = async (ctx) => {
  const { params: { i: tokenId, fileType }, query: { options } } = ctx;
  if (fileType !== 'png') ctx.throw(400, 'Crewmate cards are only available as png');

  const random = (tokenId === 'random');
  const provided = (tokenId === 'provided');
  let card;
  let crewmate;

  if (random) {
    ctx.throw(400, 'Random crewmate image generation is no longer supported');
  }

  if (provided) {
    try {
      crewmate = { Crewmate: JSON.parse(options) };
      card = await CrewmateService.getCard({ crewmateDoc: crewmate, fileType });

      ctx.type = VALID_FILE_TYPES[fileType];
      ctx.body = card;

      return;
    } catch (error) {
      throw ctx.throw(500, error.message || error);
    }
  }

  crewmate = await EntityService.getEntity({
    id: tokenId, label: Entity.IDS.CREWMATE, components: ['Crewmate'], format: true
  });

  if (!crewmate) ctx.throw(404, `No crewmate with id ${ctx.params.i} found`);

  card = await CrewmateService.getCard({ crewmateDoc: crewmate, fileType });
  ctx.type = VALID_FILE_TYPES[fileType];
  ctx.body = card;
};

// Returns the crewmate card for the captain of the crew.
const getCaptainCard = async (ctx) => {
  const tokenId = ctx.params.i;
  const crews = await EntityService.getEntities({
    id: tokenId, label: Entity.IDS.CREW, components: ['Crew'], format: true
  });

  if (!crews[0]) ctx.throw(404, `No crew with id ${ctx.params.i} found`);
  const captainId = crews[0].Crew.roster[0];

  if (!captainId) ctx.throw(404, `No captain found for crew with id ${ctx.params.i}`);
  ctx.params.i = captainId;
  return getCrewmateCard(ctx);
};

const getCrewCard = async (ctx) => {
  const { params: { i: tokenId, fileType } } = ctx;
  if (fileType !== 'png') ctx.throw(400, 'Crew cards are only available as png');

  const crew = await EntityService.getEntity({
    id: tokenId, label: Entity.IDS.CREW, components: ['Crew'], format: true
  });

  if (!crew) ctx.throw(404, `No crew with id ${ctx.params.i} found`);

  const card = await CrewService.getCard({ fileType });
  ctx.type = VALID_FILE_TYPES[fileType];
  ctx.body = card;
};

const getShipCard = async (ctx) => {
  const { params: { i: tokenId, fileType } } = ctx;
  if (fileType !== 'png') ctx.throw(400, 'Ship cards are only available as png');

  const ship = await EntityService.getEntity({
    id: tokenId, label: Entity.IDS.SHIP, components: ['Ship'], format: true
  });

  if (!ship) ctx.throw(404, `No ship with id ${ctx.params.i} found`);
  const card = await ShipService.getCard({ ship, fileType });
  ctx.type = VALID_FILE_TYPES[fileType];
  ctx.body = card;
};

// Add aggressive browser caching and ratelimiting for images
router.use(conditional());
router.use(etag());
router.use(ratelimit({
  driver: 'memory',
  db: new Map(),
  duration: 1000,
  errorMessage: 'Card images are rate-limited to 1 request per second',
  id: (ctx) => ((ctx.state.user && ctx.state.user.sub) ? ctx.state.user.sub : ctx.ip),
  max: 1,
  whitelist: isWhiteList
}));

router.get('/v1/asteroids/:i/image.:fileType', getAsteroidCard); // backwards compatibility
router.get('/v2/asteroids/:i/image.:fileType', getAsteroidCard);
router.get('/v1/crew/:i/image.:fileType', getCrewmateCard); // backwards compatibility
router.get('/v2/crewmates/:i/image.:fileType', getCrewmateCard);
router.get('/v2/crews/:i/captain/image.:fileType', getCaptainCard);
router.get('/v2/crews/:i/image.:fileType', getCrewCard);
router.get('/v2/ships/:i/image.:fileType', getShipCard);

module.exports = router;
