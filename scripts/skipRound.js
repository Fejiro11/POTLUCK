const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Get the deployed contract address from deployment.json
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
  console.log("Current round ID:", currentRoundId.toString());

  const roundInfo = await lottery.getCurrentRound();
  console.log("Round info:", {
    roundId: roundInfo.roundId.toString(),
    totalPool: hre.ethers.formatEther(roundInfo.totalPool),
    playerCount: roundInfo.playerCount.toString(),
    guessCount: roundInfo.guessCount.toString(),
    isSettled: roundInfo.isSettled,
  });

  const timeRemaining = await lottery.getTimeRemaining();
  console.log("Time remaining:", timeRemaining.toString(), "seconds");

  const isWaiting = await lottery.isRoundWaiting();
  console.log("Is waiting for first guess:", isWaiting);

  if (timeRemaining > 0n) {
    console.log("Round has not ended yet. Cannot skip.");
    process.exit(0);
  }

  if (roundInfo.isSettled) {
    console.log("Round is already settled.");
    process.exit(0);
  }

  if (isWaiting && roundInfo.guessCount === 0n) {
    console.log("\n⏳ Round is waiting for first guess with no players.");
    console.log("   This is normal — the round will stay open until someone submits.");
    console.log("   Use --force flag if you still want to skip.");
    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
  }

  console.log("\nSkipping stuck round...");
  const tx = await lottery.skipStuckRound();
  await tx.wait();
  
  console.log("✅ Round skipped successfully!");

  // Check new round
  const newRoundId = await lottery.currentRoundId();
  const newRoundInfo = await lottery.getCurrentRound();
  console.log("\nNew round started:");
  console.log("  Round ID:", newRoundId.toString());
  console.log("  Time remaining:", (await lottery.getTimeRemaining()).toString(), "seconds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
