const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const fs = require("fs");
  const deployment = JSON.parse(fs.readFileSync("./deployment.json", "utf8"));
  const contractAddress = deployment.contractAddress;
  
  console.log("Contract address:", contractAddress);

  const FHELotteryV2 = await hre.ethers.getContractFactory("FHELotteryV2");
  const lottery = FHELotteryV2.attach(contractAddress);

  const currentRoundId = await lottery.currentRoundId();
  console.log("\nCurrent round ID:", currentRoundId.toString());

  const roundInfo = await lottery.getCurrentRound();
  console.log("\nRound info:");
  console.log("  Round ID:", roundInfo.roundId.toString());
  console.log("  Total Pool:", hre.ethers.formatEther(roundInfo.totalPool), "ETH");
  console.log("  Player Count:", roundInfo.playerCount.toString());
  console.log("  Guess Count:", roundInfo.guessCount.toString());
  console.log("  Is Settled:", roundInfo.isSettled);
  console.log("  Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
  console.log("  End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());

  const timeRemaining = await lottery.getTimeRemaining();
  console.log("\nTime remaining:", timeRemaining.toString(), "seconds");
  
  const now = Math.floor(Date.now() / 1000);
  console.log("Current time:", new Date(now * 1000).toISOString());
  
  if (timeRemaining == 0n) {
    console.log("\n⚠️  Round has ENDED");
    if (!roundInfo.isSettled) {
      console.log("   Round is NOT settled - needs skipStuckRound()");
    }
  } else {
    console.log("\n✅ Round is ACTIVE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
