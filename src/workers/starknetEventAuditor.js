require('module-alias/register');
require('dotenv').config({ silent: true });
const appConfig = require('config');
require('@common/storage/db');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { StarknetRetriever } = require('@common/lib/events/retrievers/starknet/retriever');
const logger = require('@common/lib/logger');

const done = function (error) {
  if (error) logger.inspect(error, 'error');
  logger.info('done');
  process.exit();
};

const args = yargs(hideBin(process.argv))
  .option('run-once', {
    type: 'boolean',
    default: false,
    demand: false
  })
  .option('block-offset', {
    alias: 'blockOffset',
    type: 'number',
    demand: false
  })
  .help()
  .parse();

const main = async function ({ runOnce, blockOffset }) {
  const retriever = new StarknetRetriever();
  const resolvedBlockOffset = Number(
    typeof blockOffset !== 'undefined'
      ? blockOffset
      : appConfig.get('EventRetriever.starknet.auditBlockOffset')
  );

  try {
    if (runOnce) {
      await retriever.auditOnce({ blockOffset: resolvedBlockOffset });
      return;
    }

    await retriever.auditRunner({
      runDelay: appConfig.get('EventRetriever.starknet.auditRunDelay'),
      blockOffset: resolvedBlockOffset
    });
  } catch (error) {
    logger.inspect(error, 'error');
  }
};

main(args)
  .then(done)
  .catch(done);
