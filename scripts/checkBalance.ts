const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();

  // Get the address of the owner
  const address = await owner.getAddress();
  console.log("Address:", address);

  // Get the balance of the account
  const balance = await ethers.provider.getBalance(address);
  console.log("Balance:", ethers.utils.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
