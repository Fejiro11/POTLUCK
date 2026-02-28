# POTLUCK FHE - Private Onchain Lottery

A production-ready prototype demonstrating how Zama's Fully Homomorphic Encryption (FHE) enables privacy and fairness that cannot be achieved with traditional onchain lotteries.

## 🎰 Overview

POTLUCK FHE is a private-by-default lottery where all guesses and the winning number are encrypted throughout the round. No plaintext guesses, odds, or strategy signals are visible onchain until settlement.

### Key Features

- **Encrypted Guesses**: All player guesses are encrypted client-side using FHE before submission
- **Hidden Lucky Number**: The winning number is generated and stored encrypted for the entire round
- **Fair Settlement**: Winner determination happens through encrypted computation
- **Privacy Preserved**: Losing guesses remain encrypted permanently
- **No Observable Strategy**: Validators, indexers, and observers cannot infer strategy or odds

## 💰 Economics

| Parameter | Value |
|-----------|-------|
| Entry Fee | 0.001 ETH per guess |
| Platform Fee | 0.3% of pool |
| Round Duration | 1 hour |
| Cooling Period | 10 minutes |
| Max Players | 60 per round |
| Number Range | 0-100 inclusive |

### Winner Scaling

| Players | Max Winners |
|---------|-------------|
| 1-10 | 1 |
| 11-20 | 3 |
| 21-30 | 5 |
| 31-40 | 7 |
| 41-50 | 9 |
| 51-60 | 11 |

## 🏗️ Architecture

```
POTLUCK FHE
├── contracts/           # Solidity smart contracts
│   ├── FHELottery.sol  # Main lottery contract with FHE operations
│   └── interfaces/     # Contract interfaces
├── frontend/           # Next.js frontend application
│   ├── src/
│   │   ├── app/       # Next.js app router
│   │   ├── components/ # React components
│   │   ├── hooks/     # Custom React hooks
│   │   └── config/    # Configuration files
├── scripts/           # Deployment scripts
└── test/              # Contract tests
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

```bash
# Clone and install dependencies
cd "FHE Lottery app"
npm install
cd frontend && npm install
cd ..
```

### Local Development

```bash
# Start local Hardhat node
npm run node

# Deploy contracts (in new terminal)
npm run deploy:local

# Start frontend
npm run dev
```

### Deploy to Zama Network

```bash
# Configure .env with your private key
cp .env.example .env
# Edit .env with your credentials

# Deploy to Zama devnet
npx hardhat run scripts/deploy.js --network zama
```

## 📖 How It Works

### 1. Round Lifecycle

1. **Round Start**: A new round begins with an encrypted lucky number generated using FHE randomness
2. **Guess Submission**: Players submit encrypted guesses (0-100) with 0.001 ETH entry fee
3. **Round End**: After 1 hour, no more guesses are accepted
4. **Settlement**: Encrypted computation determines winners based on proximity to lucky number
5. **Reveal**: Only winning addresses and their guesses are revealed; losing guesses stay encrypted
6. **Payout**: Winners receive their share; no-winner rounds allow refund claims

### 2. Winner Determination

```
1. Primary Winner: Exact match with lucky number (distance = 0)
2. Additional Winners: Ranked by encrypted proximity to lucky number
3. Tie Breaking: Submission order (first come, first served)
```

**Important**: A round only pays out if at least one participant correctly guesses the lucky number. If no exact match exists, all players can claim refunds (minus platform fee).

### 3. Payout Distribution

Winners receive decreasing shares based on rank:

| Winners | 1st | 2nd | 3rd | 4th | 5th |
|---------|-----|-----|-----|-----|-----|
| 1 | 100% | - | - | - | - |
| 3 | 50% | 30% | 20% | - | - |
| 5 | 35% | 25% | 20% | 12% | 8% |

## 🔐 Security & Privacy

### FHE Guarantees

- **No Branching on Plaintext**: Contract logic never branches on decrypted values during the round
- **Encrypted Computation**: All comparisons and sorting happen on ciphertexts
- **Selective Reveal**: Only winner information is decrypted at settlement
- **Permanent Privacy**: Losing guesses are never decrypted

### Smart Contract Security

- No observable difference between guesses or players onchain
- Platform fee calculated deterministically
- Refund mechanism for no-winner rounds
- Owner functions limited to emergencies only

## 🛠️ Technical Stack

### Smart Contracts
- Solidity 0.8.24
- Hardhat
- Zama fhEVM (TFHE library)

### Frontend
- Next.js 14
- React 18
- ethers.js v6
- fhevmjs
- TailwindCSS
- Lucide Icons

## 📝 Contract API

### Core Functions

```solidity
// Submit an encrypted guess
function submitGuess(einput _encryptedGuess, bytes calldata _inputProof) external payable;

// Submit multiple guesses
function submitMultipleGuesses(einput[] calldata _encryptedGuesses, bytes[] calldata _inputProofs) external payable;

// Initiate settlement after round ends
function initiateSettlement(uint256 _roundId) external;

// Claim refund for no-winner rounds
function claimRefund(uint256 _roundId) external;
```

### View Functions

```solidity
function getCurrentRound() external view returns (uint256 roundId, uint256 startTime, uint256 endTime, uint256 totalPool, uint256 playerCount, uint256 guessCount, bool isSettled);

function getRoundResults(uint256 _roundId) external view returns (bool isSettled, bool hasExactMatch, uint8 luckyNumber, address[] memory winners, uint256[] memory payouts);

function canClaimRefund(uint256 _roundId, address _player) external view returns (bool);
```

## 🎨 UI Design

The frontend follows a minimal, modern crypto-style design:
- **Colors**: Black, blue, and white
- **No Live Stats**: No guess distribution or probability indicators during rounds
- **Privacy First**: No information that could reveal strategy

## 📄 License

MIT

## 🙏 Acknowledgments

- [Zama](https://zama.ai) for the fhEVM and FHE tooling
- The Ethereum community for infrastructure and tooling

---

**Disclaimer**: This is a prototype for demonstration purposes. Please audit thoroughly before any production deployment.
