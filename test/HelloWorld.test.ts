import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransactionResponse, Signer } from "ethers";
import { HelloWorld } from '../typechain-types';

describe("HelloWorld", function () {
  let helloWorld: HelloWorld & { deploymentTransaction(): ContractTransactionResponse };
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    helloWorld = await HelloWorld.deploy();
    await helloWorld.waitForDeployment();
  });

  it("Should have the correct initial greeting", async function () {
    const greeting = await helloWorld.greeting();
    expect(greeting).to.equal("Hello World");
  });

  it("Should update the greeting", async function () {
    const newGreeting = "Hello Ethereum";
    await helloWorld.setGreeting(newGreeting);
    const greeting = await helloWorld.greeting();
    expect(greeting).to.equal(newGreeting);
  });
});
