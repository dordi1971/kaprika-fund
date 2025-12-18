// Minimal ABIs needed by the UI.

export const KaprikaProjectFactoryAbi = [
  {
    type: "function",
    name: "creationFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "createProject",
    stateMutability: "payable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "projectURI", type: "string" },
          { name: "stampURI", type: "string" },
          { name: "acceptedToken", type: "address" },
          { name: "creator", type: "address" },
          { name: "targetAmount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "stampPrice", type: "uint256" },
          { name: "maxBlueSupply", type: "uint256" },
          { name: "voteDuration", type: "uint64" },
          { name: "quorumBps", type: "uint16" },
          { name: "releaseBps", type: "uint16[]" },
        ],
      },
    ],
    outputs: [{ name: "projectId", type: "uint256" }, { name: "project", type: "address" }],
  },
  {
    type: "function",
    name: "projectById",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "ProjectCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "projectId", type: "uint256" },
      { indexed: true, name: "project", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "implementation", type: "address" },
      { indexed: false, name: "version", type: "string" },
      { indexed: false, name: "projectURI", type: "string" },
    ],
  },
] as const;

export const KaprikaProjectAbi = [
  { type: "function", name: "projectURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "stampURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "acceptedToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "creator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "targetAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deadline", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "stampPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxBlueSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "voteDuration", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "quorumBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "raised", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "released", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "blueMinted", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nextTrancheIndex", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "trancheCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "releaseBps", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ type: "uint16" }] },
  { type: "function", name: "state", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "buyBlue", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
] as const;

export const Erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// Back-compat for older imports.
export const ERC20Abi = Erc20Abi;
