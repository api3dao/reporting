export type DeploymentsContract = Record<string, string>;

export interface Deployments {
  chainNames: Record<string, string>;
  contracts: Record<string, DeploymentsContract>;
}

export interface ContractAddressParams {
  chainId?: string;
  chainName?: string;
}

export interface ParseQueryParams {
  query: string;
  chain: string;
  address?: string;
  time: string;
  interval: string;
  output: string;
}
