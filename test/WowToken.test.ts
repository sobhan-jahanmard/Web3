import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Signer,
  Contract,
  BigNumberish,
  ContractTransactionResponse,
} from "ethers";
import { WoWToken, WoWToken__factory } from "../typechain-types";

describe("WoWToken", function () {
  let wowTokenFactory: WoWToken__factory;
  let wowToken: WoWToken & {
    deploymentTransaction(): ContractTransactionResponse;
  };
  let owner: Signer;
  let recipient: Signer;
  let initialSupply: bigint;

  // Deploy the contract before each test
  beforeEach(async function () {
    // Get signers (owner and any other needed accounts)
    [owner, recipient] = await ethers.getSigners();

    // Get the contract factory for WoWToken
    wowTokenFactory = await ethers.getContractFactory("WoWToken");

    // Deploy the contract with the owner's address
    wowToken = await wowTokenFactory.deploy(await owner.getAddress());
    await wowToken.waitForDeployment();

    // Dynamically get the initial supply after deployment
    initialSupply = await wowToken.getInitialSupply();
  });

  it("Should mint tokens to the owner during deployment", async function () {
    // Get the owner's balance
    const ownerBalance = await wowToken.balanceOf(await owner.getAddress());

    // The owner's balance should be equal to the initial supply
    expect(ownerBalance).to.equal(initialSupply);
  });

  it("Should allow minting more tokens", async function () {
    const mintAmount: BigNumberish = ethers.parseUnits("1000", 18);
    await wowToken.mint(await owner.getAddress(), mintAmount);

    // Convert initialSupply and mintAmount to BigNumber
    const initialSupplyBN = initialSupply;
    const mintAmountBN = BigInt(mintAmount);

    // After minting, the balance should increase by the mintAmount
    const ownerBalance = await wowToken.balanceOf(await owner.getAddress());

    // Use BigNumber methods for addition
    expect(ownerBalance).to.equal(initialSupplyBN + mintAmountBN); // initial supply + minted tokens
  });

  it("Should allow burning tokens", async function () {
    const mintAmount: BigNumberish = ethers.parseUnits("1000", 18);
    await wowToken.mint(await owner.getAddress(), mintAmount);

    const burnAmount: BigNumberish = ethers.parseUnits("100", 18);
    await wowToken.burn(burnAmount);

    // Convert initialSupply, mintAmount, and burnAmount to BigNumber
    const initialSupplyBN = BigInt(initialSupply);
    const mintAmountBN = BigInt(mintAmount);
    const burnAmountBN = BigInt(burnAmount);

    // After burning, the balance should decrease by the burnAmount
    const ownerBalance = await wowToken.balanceOf(await owner.getAddress());

    // Use BigNumber methods for subtraction
    expect(ownerBalance).to.equal(
      initialSupplyBN + mintAmountBN - burnAmountBN
    ); // initial supply - burnAmount
  });

  it("Should transfer 1000 tokens to another account", async function () {
    // Get the initial balances of the owner and recipient
    const ownerBalanceBefore = await wowToken.balanceOf(
      await owner.getAddress()
    );
    const recipientBalanceBefore = await wowToken.balanceOf(
      await recipient.getAddress()
    );

    // Transfer 1000 tokens from owner to recipient
    const transferAmount: BigNumberish = ethers.parseUnits("500", 18);
    await wowToken.transfer(await recipient.getAddress(), transferAmount);

    // Get the final balances of the owner and recipient
    const ownerBalanceAfter = await wowToken.balanceOf(
      await owner.getAddress()
    );
    const recipientBalanceAfter = await wowToken.balanceOf(
      await recipient.getAddress()
    );

    // Check if the owner's balance decreased by the transferred amount
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore - transferAmount);
    // Check if the recipient's balance increased by the transferred amount
    expect(recipientBalanceAfter).to.equal(
      recipientBalanceBefore + transferAmount
    );
  });
});
