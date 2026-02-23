const hre = require("hardhat");

/**
 * Settlement automation script for FHELotteryV2
 * 
 * Usage:
 *   npx hardhat run scripts/settle.js --network sepolia
 * 
 * Flow:
 *   1. Check if current round has ended and needs settlement
 *   2. Call requestSettlement() if not already requested
 *   3. Wait for FINALITY_DELAY (2 minutes)
 *   4. Fetch decrypted values from Zama Relayer
 *   5. Call finalizeSettlement() with cleartext values and proof
 */

const RELAYER_URL = "https://relayer.testnet.zama.org";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchDecryptedValues(ciphertextHandles) {
  console.log(`\nFetching decrypted values for ${ciphertextHandles.length} handles from Zama Relayer...`);
  
  try {
    const response = await fetch(`${RELAYER_URL}/v1/public-decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles: ciphertextHandles }),
    });

    if (!response.ok) {
      throw new Error(`Relayer returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch from relayer:", error.message);
    throw error;
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Settlement bot account:", deployer.address);

  // Load deployment info
  const fs = require("fs");
  const deploymentPath = "./deployment.json";

  if (!fs.existsSync(deploymentPath)) {
    console.error("deployment.json not found. Please deploy the contract first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deployment.contractAddress;
  console.log("Contract address:", contractAddress);

  // Get contract instance
  const FHELotteryV2 = await hre.ethers.getContractFactory("FHELotteryV2");
  const lottery = FHELotteryV2.attach(contractAddress);

  // Check current round status
  const currentRoundId = await lottery.currentRoundId();
  console.log("\nCurrent round ID:", currentRoundId.toString());

  const roundInfo = await lottery.getCurrentRound();
  console.log("Round info:", {
    roundId: roundInfo.roundId.toString(),
    totalPool: hre.ethers.formatEther(roundInfo.totalPool),
    playerCount: roundInfo.playerCount.toString(),
    guessCount: roundInfo.guessCount.toString(),
    isSettled: roundInfo.isSettled,
  });

  if (roundInfo.isSettled) {
    console.log("\n✅ Round is already settled. Nothing to do.");
    process.exit(0);
  }

  const timeRemaining = await lottery.getTimeRemaining();
  if (timeRemaining > 0n) {
    console.log(`\n⏳ Round has ${timeRemaining.toString()} seconds remaining. Cannot settle yet.`);
    process.exit(0);
  }

  if (roundInfo.guessCount === 0n) {
    console.log("\n⚠️  No guesses in this round. Use skipStuckRound instead.");
    process.exit(0);
  }

  // Step 1: Check if decryption already requested
  const roundData = await lottery.rounds(currentRoundId);
  const decryptionRequestedAt = roundData.decryptionRequestedAt;

  if (decryptionRequestedAt === 0n) {
    console.log("\n📡 Step 1: Requesting settlement (marking values for public decryption)...");
    const tx = await lottery.requestSettlement(currentRoundId);
    console.log("  Transaction:", tx.hash);
    await tx.wait();
    console.log("  ✅ requestSettlement confirmed");
  } else {
    console.log("\n📡 Step 1: Decryption already requested at block timestamp", decryptionRequestedAt.toString());
  }

  // Step 2: Wait for finality delay
  const FINALITY_DELAY = await lottery.FINALITY_DELAY();
  const updatedRound = await lottery.rounds(currentRoundId);
  const readyAt = Number(updatedRound.decryptionRequestedAt) + Number(FINALITY_DELAY);
  const now = Math.floor(Date.now() / 1000);

  if (now < readyAt) {
    const waitSeconds = readyAt - now + 5; // +5s buffer
    console.log(`\n⏳ Step 2: Waiting ${waitSeconds}s for finality delay...`);
    await sleep(waitSeconds * 1000);
  } else {
    console.log("\n✅ Step 2: Finality delay already passed");
  }

  // Step 3: Fetch decrypted values from Zama Relayer
  console.log("\n🔓 Step 3: Fetching decrypted values from Zama Relayer...");
  
  // Build the list of ciphertext handles we need decrypted
  // Handle 0 = lucky number, handles 1..N = distances
  const guessCount = Number(roundInfo.guessCount);
  const handles = [];

  // We need to read the encrypted handles from contract storage
  // The lucky number handle is stored in the round struct
  // The distance handles are stored in roundGuesses
  console.log(`  Need to decrypt: 1 lucky number + ${guessCount} distances = ${1 + guessCount} values`);

  try {
    const decryptionResult = await fetchDecryptedValues(handles);
    
    const luckyNumber = decryptionResult.values[0];
    const distances = decryptionResult.values.slice(1);
    const proof = decryptionResult.proof;

    console.log(`  Lucky number: ${luckyNumber}`);
    console.log(`  Distances: [${distances.join(", ")}]`);

    // Step 4: Finalize settlement
    console.log("\n🏆 Step 4: Finalizing settlement...");
    const finalizeTx = await lottery.finalizeSettlement(
      currentRoundId,
      luckyNumber,
      distances,
      proof
    );
    console.log("  Transaction:", finalizeTx.hash);
    await finalizeTx.wait();
    console.log("  ✅ Settlement finalized!");

    // Show results
    const results = await lottery.getRoundResults(currentRoundId);
    console.log("\n📋 Round Results:");
    console.log("  Lucky Number:", results.luckyNumber);
    console.log("  Has Exact Match:", results.hasExactMatch);
    console.log("  Winners:", results.winners.length);
    for (let i = 0; i < results.winners.length; i++) {
      console.log(`    ${i + 1}. ${results.winners[i]} → ${hre.ethers.formatEther(results.payouts[i])} ETH`);
    }

  } catch (error) {
    console.error("\n❌ Settlement failed:", error.message);
    console.log("\nNote: The Zama Relayer API endpoint and response format may need adjustment");
    console.log("based on the actual relayer documentation. The handles for ciphertext values");
    console.log("need to be read from contract events or storage to pass to the relayer.");
    console.log("\nAlternative: Use the Zama Relayer SDK in a Node.js script with the");
    console.log("@zama-fhe/relayer-sdk package for proper handle resolution and decryption.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
