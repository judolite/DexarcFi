/** Public addresses and endpoints for the DexArcFi risk agent. */

/** Where the deployed app lives. The Agent Card and MCP endpoint are served from here. */
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '') || 'https://dexarcfi.vercel.app'

export const AGENT_CARD_URL = `${PUBLIC_URL}/.well-known/agent-card.json`
export const MCP_URL = `${PUBLIC_URL}/api/mcp`

/** ERC-8004 IdentityRegistry on Arc Testnet (Arc docs, contract addresses). */
export const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

export const identityRegistryAbi = [
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'tokenURI', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event', name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const

/**
 * Set only after the agent is registered in Concordium's CIS-8004 registry: the
 * agent's token address. When unset the app shows "Not verified".
 */
export const CONCORDIUM_BADGE = (import.meta.env.VITE_CONCORDIUM_BADGE as string | undefined)?.trim() || ''

export const CONCORDIUM_DOCS = 'https://docs.concordium.com/en/mainnet/how-to/integrations/agent-registry.html'
export const X402_DOCS = 'https://developers.circle.com/gateway-nanopayments'
