const OpenSea = require('./OpenSea');
const Element = require('./Element');

const updateAsteroidAsset = async (props) => {
  await OpenSea.updateAsteroidAsset(props);
  if (Element.isEnabled()) await Element.updateAsteroidAsset(props);
};

const updateCrewmateAsset = async (props) => {
  await OpenSea.updateCrewmateAsset(props);
  if (Element.isEnabled()) await Element.updateCrewmateAsset(props);
};

module.exports = {
  Element,
  OpenSea,
  updateAsteroidAsset,
  updateCrewmateAsset
};
