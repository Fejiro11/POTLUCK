import { FHELotteryV2 } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  platformWallet: HardhatEthersSigner;
};

async function deployFixture() {
  const signers = await ethers.getSigners();
  const platformWallet = signers[3];

  const factory = await ethers.getContractFactory("FHELotteryV2");
  const lottery = (await factory.deploy(platformWallet.address)) as FHELotteryV2;
  const lotteryAddress = await lottery.getAddress();

  return { lottery, lotteryAddress, platformWallet };
}

describe("FHELotteryV2", function () {
  let signers: Signers;
  let lottery: FHELotteryV2;
  let lotteryAddress: string;

  const ENTRY_FEE = ethers.parseEther("0.001");

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      platformWallet: ethSigners[3],
    };
  });

  beforeEach(async function () {
    const fixture = await deployFixture();
    lottery = fixture.lottery;
    lotteryAddress = fixture.lotteryAddress;
  });

  describe("Deployment", function () {
    it("should be deployed with valid address", async function () {
      console.log(`FHELotteryV2 deployed at: ${lotteryAddress}`);
      expect(ethers.isAddress(lotteryAddress)).to.eq(true);
    });

    it("should set correct owner", async function () {
      expect(await lottery.owner()).to.equal(signers.deployer.address);
    });

    it("should set correct platform wallet", async function () {
      expect(await lottery.platformWallet()).to.equal(signers.platformWallet.address);
    });

    it("should start with round 1", async function () {
      expect(await lottery.currentRoundId()).to.equal(1);
    });

    it("should have correct constants", async function () {
      expect(await lottery.ENTRY_FEE()).to.equal(ENTRY_FEE);
      expect(await lottery.ROUND_DURATION()).to.equal(600); // 10 minutes
      expect(await lottery.COOLING_PERIOD()).to.equal(600); // 10 minutes
      expect(await lottery.MAX_PLAYERS()).to.equal(60);
      expect(await lottery.MAX_NUMBER()).to.equal(100);
      expect(await lottery.PLATFORM_FEE_BPS()).to.equal(30);
      expect(await lottery.FINALITY_DELAY()).to.equal(120); // 2 minutes
    });
  });

  describe("Round Info", function () {
    it("should return current round info", async function () {
      const roundInfo = await lottery.getCurrentRound();

      expect(roundInfo.roundId).to.equal(1);
      expect(roundInfo.totalPool).to.equal(0);
      expect(roundInfo.playerCount).to.equal(0);
      expect(roundInfo.guessCount).to.equal(0);
      expect(roundInfo.isSettled).to.equal(false);
    });

    it("should return time remaining", async function () {
      const timeRemaining = await lottery.getTimeRemaining();
      expect(timeRemaining).to.be.gt(0);
      expect(timeRemaining).to.be.lte(600); // 10 minutes max
    });
  });

  describe("Encrypted Guess Submission", function () {
    it("should submit encrypted guess with proper FHE flow", async function () {
      // Create encrypted input per Zama docs
      const guessValue = 42;
      const encryptedGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.alice.address)
        .add8(guessValue)
        .encrypt();

      // Submit the encrypted guess
      const tx = await lottery.connect(signers.alice).submitGuess(
        encryptedGuess.handles[0],
        encryptedGuess.inputProof,
        { value: ENTRY_FEE }
      );
      await tx.wait();

      // Verify guess was recorded
      const roundInfo = await lottery.getCurrentRound();
      expect(roundInfo.guessCount).to.equal(1);
      expect(roundInfo.playerCount).to.equal(1);
      expect(roundInfo.totalPool).to.equal(ENTRY_FEE);

      console.log("✅ Encrypted guess submitted successfully");
    });

    it("should submit multiple encrypted guesses", async function () {
      const guessValues = [10, 25, 50];
      const encryptedInputs = [];

      // Encrypt each guess
      for (const value of guessValues) {
        const encrypted = await fhevm
          .createEncryptedInput(lotteryAddress, signers.alice.address)
          .add8(value)
          .encrypt();
        encryptedInputs.push(encrypted);
      }

      // Extract handles and proofs
      const handles = encryptedInputs.map((e) => e.handles[0]);
      const proofs = encryptedInputs.map((e) => e.inputProof);

      // Submit multiple guesses
      const tx = await lottery.connect(signers.alice).submitMultipleGuesses(
        handles,
        proofs,
        { value: ENTRY_FEE * BigInt(guessValues.length) }
      );
      await tx.wait();

      // Verify guesses were recorded
      const roundInfo = await lottery.getCurrentRound();
      expect(roundInfo.guessCount).to.equal(guessValues.length);
      expect(roundInfo.playerCount).to.equal(1);

      console.log(`✅ ${guessValues.length} encrypted guesses submitted`);
    });

    it("should reject guess with insufficient fee", async function () {
      const encryptedGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.alice.address)
        .add8(50)
        .encrypt();

      await expect(
        lottery.connect(signers.alice).submitGuess(
          encryptedGuess.handles[0],
          encryptedGuess.inputProof,
          { value: ENTRY_FEE / 2n }
        )
      ).to.be.revertedWith("Insufficient fee");
    });

    it("should refund excess ETH", async function () {
      const encryptedGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.alice.address)
        .add8(50)
        .encrypt();

      const balanceBefore = await ethers.provider.getBalance(signers.alice.address);

      const tx = await lottery.connect(signers.alice).submitGuess(
        encryptedGuess.handles[0],
        encryptedGuess.inputProof,
        { value: ENTRY_FEE * 2n }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(signers.alice.address);

      // Should only have spent ENTRY_FEE + gas
      const spent = balanceBefore - balanceAfter;
      expect(spent).to.be.closeTo(ENTRY_FEE + gasUsed, ethers.parseEther("0.0001") as bigint);
    });

    it("should track player contributions correctly", async function () {
      const encryptedGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.alice.address)
        .add8(42)
        .encrypt();

      await lottery.connect(signers.alice).submitGuess(
        encryptedGuess.handles[0],
        encryptedGuess.inputProof,
        { value: ENTRY_FEE }
      );

      const [guessIndices, contribution] = await lottery.getPlayerGuesses(1, signers.alice.address);
      expect(guessIndices.length).to.equal(1);
      expect(contribution).to.equal(ENTRY_FEE);
    });
  });

  describe("Multiple Players", function () {
    it("should handle guesses from multiple players", async function () {
      // Alice submits a guess
      const aliceGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.alice.address)
        .add8(25)
        .encrypt();

      await lottery.connect(signers.alice).submitGuess(
        aliceGuess.handles[0],
        aliceGuess.inputProof,
        { value: ENTRY_FEE }
      );

      // Bob submits a guess
      const bobGuess = await fhevm
        .createEncryptedInput(lotteryAddress, signers.bob.address)
        .add8(75)
        .encrypt();

      await lottery.connect(signers.bob).submitGuess(
        bobGuess.handles[0],
        bobGuess.inputProof,
        { value: ENTRY_FEE }
      );

      // Verify both players are tracked
      const roundInfo = await lottery.getCurrentRound();
      expect(roundInfo.playerCount).to.equal(2);
      expect(roundInfo.guessCount).to.equal(2);
      expect(roundInfo.totalPool).to.equal(ENTRY_FEE * 2n);

      console.log("✅ Multiple players submitted guesses");
    });
  });

  describe("View Functions", function () {
    it("should check if player can claim refund (false for active round)", async function () {
      const canClaim = await lottery.canClaimRefund(1, signers.alice.address);
      expect(canClaim).to.equal(false);
    });

    it("should check if new round can start", async function () {
      const canStart = await lottery.canStartNewRound();
      expect(canStart).to.equal(false); // Current round not settled
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update platform wallet", async function () {
      await lottery.setPlatformWallet(signers.alice.address);
      expect(await lottery.platformWallet()).to.equal(signers.alice.address);
    });

    it("should not allow non-owner to update platform wallet", async function () {
      await expect(
        lottery.connect(signers.alice).setPlatformWallet(signers.bob.address)
      ).to.be.revertedWith("Only owner");
    });

    it("should allow owner to initiate ownership transfer (2-step)", async function () {
      await lottery.transferOwnership(signers.alice.address);
      // Owner should NOT change yet
      expect(await lottery.owner()).to.equal(signers.deployer.address);
      expect(await lottery.pendingOwner()).to.equal(signers.alice.address);
    });

    it("should allow pending owner to accept ownership", async function () {
      await lottery.transferOwnership(signers.alice.address);
      await lottery.connect(signers.alice).acceptOwnership();
      expect(await lottery.owner()).to.equal(signers.alice.address);
      expect(await lottery.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("should not allow non-pending owner to accept ownership", async function () {
      await lottery.transferOwnership(signers.alice.address);
      await expect(
        lottery.connect(signers.bob).acceptOwnership()
      ).to.be.revertedWith("Not pending owner");
    });

    it("should not allow transferring ownership to zero address", async function () {
      await expect(
        lottery.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Contract ETH Handling", function () {
    it("should accept ETH via receive function", async function () {
      await expect(
        signers.deployer.sendTransaction({
          to: lotteryAddress,
          value: ethers.parseEther("0.1"),
        })
      ).to.not.be.reverted;
    });

    it("should allow emergency withdraw by owner", async function () {
      // Send some ETH to contract
      await signers.deployer.sendTransaction({
        to: lotteryAddress,
        value: ethers.parseEther("0.1"),
      });

      const balanceBefore = await ethers.provider.getBalance(signers.deployer.address);

      const tx = await lottery.emergencyWithdraw();
      await tx.wait();

      const contractBalance = await ethers.provider.getBalance(lotteryAddress);
      expect(contractBalance).to.equal(0);
    });
  });
});

describe("FHELotteryV2 Settlement Flow", function () {
  // Note: Full settlement testing requires Zama infrastructure
  // These tests outline the expected flow

  it("should outline the expected settlement flow", async function () {
    /*
    Settlement Flow (per Zama docs):
    
    1. Round ends (block.timestamp >= round.endTime)
    
    2. Call requestSettlement(_roundId):
       - Computes encrypted distances for all guesses
       - Calls FHE.makePubliclyDecryptable() on lucky number and distances
       - Records decryptionRequestedAt timestamp
       - Emits DecryptionRequested event
    
    3. Wait for FINALITY_DELAY (2 minutes) to prevent block reorg attacks
    
    4. Off-chain: Use Zama Relayer SDK to get cleartext values and proof:
       const results = await instance.publicDecrypt([luckyNumber, ...distances]);
       const decryptionProof = results.decryptionProof;
    
    5. Call finalizeSettlement(_roundId, _luckyNumber, _distances, _decryptionProof):
       - Verifies finality delay has passed
       - Sets isSettled = true (CEI pattern)
       - Calls FHE.checkSignatures() to verify proof
       - Processes winners and distributes payouts
       - Starts new round
    */
    expect(true).to.be.true;
  });

  it("should document winner selection rules", async function () {
    /*
    Winner Selection Rules:
    
    1. Primary criterion: Distance from lucky number (distance = 0 is exact match)
    2. Tie breaker: Submission order (earlier submission wins)
    3. One win per player: If player has multiple guesses, only best counts
    
    Max Winners by Player Count:
    - 1-10 players:  1 winner
    - 11-20 players: 3 winners
    - 21-30 players: 5 winners
    - 31-40 players: 7 winners
    - 41-50 players: 9 winners
    - 51-60 players: 11 winners
    
    No-Winner Round:
    - If no exact match (distance = 0), round has no winners
    - Players can claim refunds (minus platform fee share)
    */
    expect(true).to.be.true;
  });

  it("should document payout distribution", async function () {
    /*
    Payout Distribution (after 0.3% platform fee):
    
    1 Winner:  100%
    
    3 Winners: 50%, 30%, 20%
    
    5 Winners: 35%, 25%, 20%, 12%, 8%
    
    7 Winners: 30%, 20%, 17%, 13%, 10%, 6%, 4%
    
    9 Winners: 25%, 18%, 14%, 12%, 10%, 8%, 6%, 4%, 3%
    
    11 Winners: 22%, 16%, 13%, 11%, 9%, 8%, 7%, 5.5%, 4%, 3%, 1.5%
    */
    expect(true).to.be.true;
  });
});

describe("FHELotteryV2 Security Features", function () {
  it("should document security measures per Zama guidelines", async function () {
    /*
    Security Measures Implemented:
    
    1. FINALITY_DELAY (2 minutes):
       - Prevents block reorganization attacks
       - Must wait after requestSettlement before finalizeSettlement
    
    2. CEI Pattern (Checks-Effects-Interactions):
       - isSettled = true BEFORE external calls
       - Prevents reentrancy and replay attacks
    
    3. FHE Permissions (ACL):
       - FHE.allowThis() for contract access
       - FHE.allow() for user access
       - Ensures only authorized parties can decrypt
    
    4. Signature Verification:
       - FHE.checkSignatures() verifies Zama KMS proof
       - Prevents submission of fake cleartext values
    
    5. Input Validation:
       - FHE.fromExternal() with inputProof
       - Ensures encrypted inputs are valid and bound to user/contract
    */
    expect(true).to.be.true;
  });
});
