import { ethers } from "hardhat";

async function main() {
  console.log("Deploying started");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer?.address);

  // Get the provider (it should be injected by Hardhat)
  const provider = ethers.provider;

  // Get the balance of the deployer's address
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance ETH Before:", ethers.formatEther(balance), "ETH");

  // Deploy the contract
  const WoWToken = await ethers.getContractFactory("WoWToken");
  const wowToken = await WoWToken.deploy(deployer.address); // Pass deployer's address as initialOwner

  await wowToken.waitForDeployment();
  const balance2 = await provider.getBalance(deployer.address);
  console.log("Balance ETH After:", ethers.formatEther(balance2), "ETH");

  const deployerBalanceOfNewToken = await wowToken.balanceOf(deployer.address);
  console.log(
    "Balance New Token After:",
    ethers.formatEther(deployerBalanceOfNewToken),
    "ETH"
  );

  console.log("WoWToken deployed to:", await wowToken.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
