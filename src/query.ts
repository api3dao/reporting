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
    "SELECT event_data->>'address' as address, chain, SUM(bn_to_numeric(transaction_data->'gasUsed'->>'hex') * bn_to_numeric(transaction_data->'effectiveGasPrice'->>'hex')) as totalfees FROM dapi_events _DATE_ GROUP BY address, chain;",
  'beacons-gas-cost-interval':
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
  const parsedArgs = minimist(args, { string: ['query', 'chain', 'time', 'interval', 'start', 'end', 'output'] });

  let { query, chain, time, interval, start, end, output } = parsedArgs;

  // Get DapiServer address if a chain is specified
  let address;
  if (chain) address = getContractAddress(deployments, { chainName: chain });

  return { query, chain, address, time, interval, start, end, output };
};

export const parseDate = (date: string) => {
  const splitDateArray = date.split('-');
  const day = parseInt(splitDateArray[0]);
  const month = parseInt(splitDateArray[1]) - 1;
  const year = parseInt(splitDateArray[2]);

  return new Date(year, month, day).getTime() / 1000;
};

export const parseQuery = (args: ParseQueryParams) => {
  const { query, chain, address, time, interval, start, end, output } = args;

  if (query.includes('custom:')) return query.split('custom:')[1].trim();

  let queryToSqlQuery = sqlQueries[query];

  if (!queryToSqlQuery)
    throw new Error(
      `The query is not supported. To use a custom query please use the custom query format: --query="custom: <CUSTOM SQL QUERY>"`
    );

  // Address
  if (address) queryToSqlQuery = queryToSqlQuery.replace('_ADDRESS_', address);

  // Interval inputs
  if (time) queryToSqlQuery = queryToSqlQuery.replace('_TIME_', timeArgToTimeWord[time]);
  if (interval) queryToSqlQuery = queryToSqlQuery.replace('_INTERVAL_', interval);

  // Date inputs
  if (start || end) {
    const startTimestamp = start ? parseDate(start) : null;
    const endTimestamp = end ? parseDate(end) : null;

    if (start && end) {
      queryToSqlQuery = queryToSqlQuery.replace(
        '_DATE_',
        `WHERE extract(epoch from time) > ${startTimestamp} AND extract(epoch from time) < ${endTimestamp}`
      );
    } else if (start && !end) {
      queryToSqlQuery = queryToSqlQuery.replace('_DATE_', `WHERE extract(epoch from time) > ${startTimestamp} `);
    } else if (end && !start) {
      queryToSqlQuery = queryToSqlQuery.replace('_DATE_', `WHERE extract(epoch from time) < ${endTimestamp} `);
    }
  } else {
    queryToSqlQuery = queryToSqlQuery.replace('_DATE_', ``);
  }

  return queryToSqlQuery;
};

export const processSqlOutputToHtml = async (output: any) => {
  let htmlContent = '';
  output.rows.forEach((row: Record<string, string>) => {
    let rowContent = '';
    Object.entries(row).forEach(([key, value]) => {
      // Handle JSON objects
      let formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;

      let dataContent = '';

      // Handle extra fields based on query result data
      // Add in the chain name when a chainId is found in the output
      if (key === 'chain')
        dataContent += `<tr><td>${'name'}</td><td>${deployments.chainNames[formattedValue]}</td></tr>`;

      // Handle specific result keys, e.g. formatting wei values
      if (key === 'totalfees') {
        dataContent += `<td>${key}</td><td>${ethers.utils.formatEther(ethers.BigNumber.from(formattedValue))}</td>`;
      } else {
        dataContent += `<td>${key}</td><td>${formattedValue}</td>`;
      }

      rowContent += `<tr>${dataContent}</tr>`;
    });
    console.log('rowcontent', rowContent);
    htmlContent += `<table style="margin-bottom:1rem;">${rowContent}</table>`;
  });
  console.log('htmlCOntent', htmlContent);

  const html = `${htmlContent}`;

  const timestamp = Date.now();

  return fs.writeFileSync(path.join(__dirname, `../exports/${'report'}_${'timestamp'}.html`), html);
};

export const processSqlOutputToJson = (chainName: string, output: any) => {
  const timestamp = Date.now();
  return fs.writeFileSync(
    path.join(__dirname, `../exports/${chainName}_${'timestamp'}.json`),
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
