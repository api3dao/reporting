import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import minimist from 'minimist';
import { Deployments, ContractAddressParams, ParseQueryParams } from './types';
import * as importedDeployments from '@api3/operations/chain/deployments/references.json';

const deployments: Deployments = importedDeployments;

const timeArgToTimeWord: Record<string, string> = {
  d: 'DAY',
  m: 'MONTH',
  w: 'WEEK',
  y: 'YEAR',
};

const dapiServerAddressToChainName = (address: string) => {
  const dapiServer = Object.entries(deployments.contracts.DapiServer).find(
    ([_chainId, chainAddress]) => chainAddress === address
  );
  if (!dapiServer) return null;

  const [chainId] = dapiServer;
  const chainName = deployments.chainNames[chainId];

  return chainName;
};

// Map CLI output formats to output types
export const outputFormats: Record<string, string> = {
  json: 'json',
  html: 'html',
};

// Map CLI query arguments to SQL queries
export const sqlQueries: Record<string, string> = {
  // Perform a custom query to the db
  custom: '_CUSTOM_',
  // Return all event data for a DapiServer address
  'beacon-events-full': "SELECT * FROM dapi_events WHERE event_data->'address' = '_ADDRESS_';",
  // Return all transaction data for a DapiServer address
  'beacon-transactions-full': "SELECT * FROM dapi_transactions WHERE transaction_data->'to' = '_ADDRESS_';",
  // Calculate total gas cost for a DapiServer address for full history
  'beacon-gas-cost':
    "SELECT event_data->>'address' as address, chain, SUM(bn_to_numeric(transaction_data->'gasUsed'->>'hex') * bn_to_numeric(transaction_data->'effectiveGasPrice'->>'hex')) as totalfees FROM dapi_events WHERE event_data->>'address' = '_ADDRESS_' GROUP BY address, chain;",
  // SELECT SUM(bn_to_numeric(transaction_data->'gasUsed'->>'hex') * bn_to_numeric(transaction_data->'effectiveGasPrice'->>'hex')) FROM dapi_events WHERE event_data->>'address' = '0xd7CA5BD7a45985D271F216Cb1CAD82348464f6d5';
  // Calculate beacon gas costs for all DapiServer addresses and group results
  'beacons-gas-cost-all':
    "SELECT event_data->>'address' as address, chain, SUM(bn_to_numeric(transaction_data->'gasUsed'->>'hex') * bn_to_numeric(transaction_data->'effectiveGasPrice'->>'hex')) as totalfees FROM dapi_events GROUP BY address, chain;",
  'beacons-gas-cost-time':
    "SELECT event_data->>'address' as address, chain, SUM(bn_to_numeric(transaction_data->'gasUsed'->>'hex') * bn_to_numeric(transaction_data->'effectiveGasPrice'->>'hex')) as totalfees FROM dapi_events WHERE time > NOW() - INTERVAL '_INTERVAL_ _TIME_' GROUP BY address, chain;",
};

export const getContractAddress = (deployments: Deployments, params: ContractAddressParams) => {
  let chainId: string | undefined;
  if (params.chainName) {
    chainId = Object.keys(deployments.chainNames).find(
      (chainId) => deployments.chainNames[chainId] === params.chainName
    );
  }

  if (!chainId) throw new Error(`No chainId found in deployments with chainName: ${params.chainName}`);

  const contractAddress = deployments.contracts.DapiServer[chainId];

  if (!contractAddress)
    throw new Error(
      `No contract found in deployments with ${
        (params.chainId && 'chainId: ' + params.chainId) || (params.chainName && 'chainName: ' + params.chainName)
      }`
    );
  return contractAddress;
};

export const parseArguments = (deployments: Deployments, args: string[]) => {
  const parsedArgs = minimist(args, { string: ['query', 'chain', 'time', 'interval', 'output'] });
  console.log('parsedArgs', parsedArgs);
  let { query, chain, time, interval, output } = parsedArgs;

  let address;
  if (chain) address = getContractAddress(deployments, { chainName: chain });

  return { query, chain, address, time, interval, output };
};

export const parseQuery = (args: ParseQueryParams) => {
  const { query, chain, address, time, interval, output } = args;

  if (query.includes('custom:')) return query.split('custom:')[1].trim();

  let queryToSqlQuery = sqlQueries[query];

  if (!queryToSqlQuery)
    throw new Error(
      `The query is not supported. To use a custom query please use the custom query format: --query="custom: <CUSTOM SQL QUERY>"`
    );

  if (address) queryToSqlQuery = queryToSqlQuery.replace('_ADDRESS_', address);
  if (time) queryToSqlQuery = queryToSqlQuery.replace('_TIME_', timeArgToTimeWord[time]);
  if (interval) queryToSqlQuery = queryToSqlQuery.replace('_INTERVAL_', interval);

  return queryToSqlQuery;
};

export const processSqlOutputToHtml = async (output: any) => {
  let htmlContent = '';

  output.rows.forEach((row: Record<string, string>) =>
    Object.entries(row).forEach(([key, value]) => {
      let formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;

      // Add in the chain name when a chainId is found in the output
      if (key === 'chain')
        htmlContent += `<tr><td>${'name'}</td><td>${deployments.chainNames[formattedValue]}</td></tr>`;
      if (key === 'totalfees') {
        return (htmlContent += `<tr><td>${key}</td><td>${ethers.utils.formatEther(
          ethers.BigNumber.from(formattedValue)
        )}</td></tr>`);
      }

      htmlContent += `<tr><td>${key}</td><td>${formattedValue}</td></tr>`;
    })
  );

  const html = `<table>${htmlContent}</table>`;

  const timestamp = Date.now();

  return fs.writeFileSync(path.join(__dirname, `../exports/${'report'}_${timestamp}.html`), html);
};

export const processSqlOutputToJson = (chainName: string, output: any) => {
  const timestamp = Date.now();
  return fs.writeFileSync(
    path.join(__dirname, `../exports/${chainName}_${timestamp}.json`),
    JSON.stringify(output, null, 2)
  );
};

export const processOutput = async (format: string, chainName: string, output: any) => {
  const formatToOutputFormat = outputFormats[format];

  if (!formatToOutputFormat) throw new Error('Output format is not supported.');

  // Create exports folder if it does not exist
  !fs.existsSync(`./exports/`) && fs.mkdirSync(`./exports/`, { recursive: true });

  if (formatToOutputFormat === outputFormats.html) return processSqlOutputToHtml(output);
  if (formatToOutputFormat === outputFormats.json) return processSqlOutputToJson(chainName, output);
};
