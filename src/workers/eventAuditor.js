require('module-alias/register');
require('dotenv').config({ silent: true });
require('@common/storage/db');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { CombinedEventAuditor } = require('@common/lib/events/auditors');
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
  .help()
  .parse();

const main = async function ({ runOnce }) {
  const auditor = new CombinedEventAuditor();

  try {
    if (runOnce) {
      await auditor.runOnce();
      return;
    }

    await auditor.runner();
  } catch (error) {
    logger.inspect(error, 'error');
  }
};

main(args)
  .then(done)
  .catch(done);
