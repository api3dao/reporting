import dotenv from 'dotenv';
import { initDb } from './database';
import * as importedDeployments from '@api3/operations/chain/deployments/references.json';
import { DeploymentsContract, Deployments } from './types';
import { getContractAddress, parseArguments, parseQuery, processOutput } from './query';

// const AIRKEEPER_BEACON_UPDATE_EVENT = 'UpdatedBeaconWithPsp';
// const AIRSEEKER_BEACON_UPDATE_EVENT = 'UpdatedBeaconWithSignedData';

//Load .env environment variables
dotenv.config();

export const main = async (deployments: Deployments) => {
  const args = parseArguments(deployments, process.argv);
  console.log('main args', args);

  const query = parseQuery(args);
  console.log('main query', query);
  // Initialize DB connection if the command is valid
  const dbClient = await initDb();

  if (!dbClient) throw new Error('Failed to connect to database.');

  const queryResult = await dbClient.query(query);
  console.log(`Query result row count: `, queryResult.rowCount);
  console.log(`Query result rows: `, queryResult.rows[0]);

  // Process query result into output format
  if (args.output) processOutput(args.output, args.chain, queryResult);

  await dbClient.end();
};

main(importedDeployments)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
