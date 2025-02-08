import { ethers } from "hardhat";

async function main() {
  // Get the contract to deploy
  const contractFactory = await ethers.getContractFactory("SimpleStorage");
  const helloWorld = await contractFactory.deploy();

  const deplyedContract = await helloWorld.waitForDeployment();
  const address = await deplyedContract.getAddress();
  console.log("Contract deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
