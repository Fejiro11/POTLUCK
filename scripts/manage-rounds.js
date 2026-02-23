const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const action = process.env.ACTION || "status";
  
  // Get contract address from frontend config
  const contractsPath = path.join(__dirname, "../frontend/src/config/contracts.ts");
  const contractsContent = fs.readFileSync(contractsPath, "utf8");
  const addressMatch = contractsContent.match(/FHE_LOTTERY:\s*'(0x[a-fA-F0-9]+)'/);
  
  if (!addressMatch) {
    console.error("Could not find contract address in contracts.ts");
    process.exit(1);
  }
  
  const contractAddress = addressMatch[1];
  console.log(`Contract address: ${contractAddress}`);
  
  const [signer] = await hre.ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  const FHELottery = await hre.ethers.getContractAt("FHELotteryV2", contractAddress);
  
  switch (action) {
    case "status":
      await showStatus(FHELottery);
      break;
    case "skip":
      await skipStuckRound(FHELottery);
      break;
    case "force":
      await forceNewRound(FHELottery);
      break;
    default:
      console.log("Unknown action. Use: status, skip, or force");
  }
}

async function showStatus(contract) {
  console.log("\n=== Round Status ===");
  
  const [roundId, startTime, endTime, totalPool, playerCount, guessCount, isSettled] = 
    await contract.getCurrentRound();
  
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = Number(endTime) - now;
  
  console.log(`Round ID: ${roundId}`);
  console.log(`Start Time: ${new Date(Number(startTime) * 1000).toLocaleString()}`);
  console.log(`End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
  console.log(`Time Remaining: ${timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s` : "ENDED"}`);
  console.log(`Total Pool: ${hre.ethers.formatEther(totalPool)} ETH`);
  console.log(`Players: ${playerCount}`);
  console.log(`Guesses: ${guessCount}`);
  console.log(`Is Settled: ${isSettled}`);
  
  if (timeRemaining <= 0 && !isSettled) {
    console.log("\n⚠️  Round has ended but not settled!");
    console.log("Run with ACTION=skip to skip this round and start a new one.");
  } else if (timeRemaining > 0) {
    console.log("\n✅ Round is active. Users can submit guesses.");
  } else if (isSettled) {
    console.log("\n✅ Round is settled.");
  }
}

async function skipStuckRound(contract) {
  console.log("\n=== Skipping Stuck Round ===");
  
  try {
    const tx = await contract.skipStuckRound();
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Round skipped successfully! New round started.");
    
    await showStatus(contract);
  } catch (error) {
    console.error("Failed to skip round:", error.message);
    if (error.message.includes("Round not ended yet")) {
      console.log("The round hasn't ended yet. Wait for it to end first.");
    } else if (error.message.includes("Round already settled")) {
      console.log("The round is already settled. Use ACTION=force to start a new round.");
    }
  }
}

async function forceNewRound(contract) {
  console.log("\n=== Forcing New Round ===");
  
  try {
    const tx = await contract.forceNewRound();
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("✅ New round started!");
    
    await showStatus(contract);
  } catch (error) {
    console.error("Failed to force new round:", error.message);
    if (error.message.includes("Current round not settled")) {
      console.log("The current round is not settled. Use ACTION=skip instead.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
