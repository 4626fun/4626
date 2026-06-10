/**
 * CreatorShareOFT minimal ABI fragments used by KPR monitoring workflows.
 */
export const ShareOFTABI = [
  {
    type: "function",
    name: "gaugeController",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const
