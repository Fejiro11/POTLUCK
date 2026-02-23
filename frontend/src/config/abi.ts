export const FHE_LOTTERY_ABI = [
  // View functions
  {
    inputs: [],
    name: "getCurrentRound",
    outputs: [
      { name: "roundId", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "totalPool", type: "uint256" },
      { name: "playerCount", type: "uint256" },
      { name: "guessCount", type: "uint256" },
      { name: "isSettled", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "_roundId", type: "uint256" }],
    name: "getRoundResults",
    outputs: [
      { name: "isSettled", type: "bool" },
      { name: "hasExactMatch", type: "bool" },
      { name: "luckyNumber", type: "uint8" },
      { name: "winners", type: "address[]" },
      { name: "payouts", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_roundId", type: "uint256" },
      { name: "_player", type: "address" }
    ],
    name: "getPlayerGuesses",
    outputs: [
      { name: "guessIndices", type: "uint256[]" },
      { name: "contribution", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "_roundId", type: "uint256" },
      { name: "_player", type: "address" }
    ],
    name: "canClaimRefund",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getTimeRemaining",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "ENTRY_FEE",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "currentRoundId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "ROUND_DURATION",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "isRoundWaiting",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "FINALITY_DELAY",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "pendingOwner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "platformWallet",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  // State-changing functions
  {
    inputs: [
      { name: "_encryptedGuess", type: "bytes32" },
      { name: "_inputProof", type: "bytes" }
    ],
    name: "submitGuess",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "_encryptedGuesses", type: "bytes32[]" },
      { name: "_inputProofs", type: "bytes[]" }
    ],
    name: "submitMultipleGuesses",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [{ name: "_roundId", type: "uint256" }],
    name: "requestSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "_roundId", type: "uint256" },
      { name: "_luckyNumber", type: "uint8" },
      { name: "_distances", type: "uint8[]" },
      { name: "_decryptionProof", type: "bytes" }
    ],
    name: "finalizeSettlement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_roundId", type: "uint256" }],
    name: "claimRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "skipStuckRound",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "forceNewRound",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "_newWallet", type: "address" }],
    name: "setPlatformWallet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "emergencyWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: false, name: "startTime", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" }
    ],
    name: "RoundStarted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "guessIndex", type: "uint256" }
    ],
    name: "GuessSubmitted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: false, name: "luckyNumber", type: "uint8" },
      { indexed: false, name: "winners", type: "address[]" },
      { indexed: false, name: "payouts", type: "uint256[]" }
    ],
    name: "RoundSettled",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: false, name: "luckyNumber", type: "uint8" }
    ],
    name: "NoWinnerRound",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ],
    name: "RefundClaimed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "guess", type: "uint8" },
      { indexed: false, name: "payout", type: "uint256" }
    ],
    name: "WinnerRevealed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" }
    ],
    name: "DecryptionRequested",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "previousOwner", type: "address" },
      { indexed: true, name: "newOwner", type: "address" }
    ],
    name: "OwnershipTransferStarted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: false, name: "activatedAt", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" }
    ],
    name: "RoundActivated",
    type: "event"
  }
] as const;
