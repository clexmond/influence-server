require('module-alias/register');
require('dotenv').config({ silent: true });

const fs = require('node:fs/promises');
const path = require('node:path');
const { Asteroid } = require('@influenceth/sdk');
const Entity = require('@common/lib/Entity');
let mongooseConnection = null;

const DEFAULT_SYMBOL = 'INFLTEMP';
const DEFAULT_OUTPUT_PATH = './tmp/infltemp-votes.json';

const printHelp = () => {
  console.log(`
Usage:
  node ./bin/exportStarknetVotingSnapshot.js [--symbol INFLTEMP] [--output ./tmp/infltemp-votes.json]

This export is control-based:
  - Controlled assets come from Component_Control
  - Address attribution comes from controlling crew delegatedTo (Component_Crew.delegatedTo)

Options:
  --symbol, -s   Output symbol (default: ${DEFAULT_SYMBOL})
  --output, -o   Output file path (default: ${DEFAULT_OUTPUT_PATH})
  --help, -h     Show this help text
`);
};

const parseArgs = () => {
  const options = {
    symbol: DEFAULT_SYMBOL,
    output: DEFAULT_OUTPUT_PATH
  };
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--symbol' || arg === '-s') {
      options.symbol = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--symbol=')) {
      options.symbol = arg.split('=').slice(1).join('=');
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      options.output = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.split('=').slice(1).join('=');
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.symbol) throw new Error('Missing --symbol value');
  if (!options.output) throw new Error('Missing --output value');
  return options;
};

const isValidStarknetAddress = (address) => {
  if (typeof address !== 'string' || address.length === 0) return false;

  try {
    return BigInt(address) !== 0n;
  } catch (error) {
    return false;
  }
};

const getStats = (map, address) => {
  if (!map.has(address)) {
    map.set(address, { crewmates: 0, asteroids: 0, lots: 0 });
  }
  return map.get(address);
};

const main = async () => {
  const { symbol, output } = parseArgs();
  const { mongoose } = require('@common/storage/db');
  mongooseConnection = mongoose.connection;

  const outputPath = path.resolve(process.cwd(), output);
  const statsByAddress = new Map();
  const delegatedToByCrewUuid = new Map();

  const crewCursor = mongoose.model('CrewComponent')
    .find({})
    .select({
      'entity.uuid': 1,
      delegatedTo: 1
    })
    .lean()
    .cursor();

  for await (const crewDoc of crewCursor) {
    const delegatedTo = crewDoc?.delegatedTo;
    if (!isValidStarknetAddress(delegatedTo)) continue;
    delegatedToByCrewUuid.set(crewDoc.entity.uuid, delegatedTo);
  }

  const controlCursor = mongoose.model('ControlComponent')
    .find({
      'entity.label': { $in: [Entity.IDS.CREWMATE, Entity.IDS.ASTEROID] },
      'controller.label': Entity.IDS.CREW
    })
    .select({
      'entity.id': 1,
      'entity.label': 1,
      'controller.uuid': 1
    })
    .lean()
    .cursor();

  for await (const controlDoc of controlCursor) {
    const delegatedTo = delegatedToByCrewUuid.get(controlDoc?.controller?.uuid);
    if (!delegatedTo) continue;

    const stats = getStats(statsByAddress, delegatedTo);

    if (controlDoc.entity.label === Entity.IDS.CREWMATE) {
      stats.crewmates += 1;
      continue;
    }

    if (controlDoc.entity.label === Entity.IDS.ASTEROID) {
      stats.asteroids += 1;
      stats.lots += Asteroid.getSurfaceArea(controlDoc.entity.id);
    }
  }

  const rankedAddresses = [...statsByAddress.entries()]
    .map(([address, stats]) => ({
      address,
      votes: stats.crewmates + (stats.asteroids * 10) + Math.floor(stats.lots / 5)
    }))
    .filter(({ votes }) => votes > 0)
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.address.localeCompare(b.address);
    });

  const addressVotes = {};
  rankedAddresses.forEach(({ address, votes }) => {
    addressVotes[address] = votes;
  });

  const outputData = {
    symbol,
    addresses: addressVotes
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(outputData, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(addressVotes).length} addresses to ${outputPath}`);
};

const done = async (error) => {
  try {
    if (mongooseConnection) await mongooseConnection.close();
  } catch (_error) {
    // no-op
  }

  if (error) {
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
};

main()
  .then(() => done())
  .catch(done);
