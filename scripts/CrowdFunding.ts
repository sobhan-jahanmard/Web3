import { ethers } from "hardhat";

async function main() {
  // Get the contract to deploy
  const contractFactory = await ethers.getContractFactory("Crowdfunding");
  const helloWorld = await contractFactory.deploy(1000, 3600, 10);

  const deplyedContract = await helloWorld.waitForDeployment();
  const address = await deplyedContract.getAddress();
  console.log("Contract deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
