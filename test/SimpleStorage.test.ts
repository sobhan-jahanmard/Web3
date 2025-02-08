import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransactionResponse, Signer } from "ethers";
import { SimpleStorage } from '../typechain-types';

describe("SimpleStorage", function () {
  let contract: SimpleStorage & { deploymentTransaction(): ContractTransactionResponse };
  let owner: Signer;
  let otherAccount: Signer;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("SimpleStorage");
    contract = await contractFactory.deploy();
    await contract.waitForDeployment();
  });

  describe("Initial State", function () {
    it("should return the initial value as 0", async function () {
      const storedValue = await contract.get();
      expect(storedValue).to.equal(0);
    });
  });

  describe("Basic Operations", function () {
    it("should store the value 42", async function () {
      await contract.set(42);
      const storedValue = await contract.get();
      expect(storedValue).to.equal(42);
    });

    it("should update the stored value", async function () {
      await contract.set(100);
      let storedValue = await contract.get();
      expect(storedValue).to.equal(100);

      await contract.set(200);
      storedValue = await contract.get();
      expect(storedValue).to.equal(200);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero value", async function () {
      await contract.set(100);
      await contract.set(0);
      const storedValue = await contract.get();
      expect(storedValue).to.equal(0);
    });

    it("should handle maximum uint256 value", async function () {
      const maxUint256 = ethers.MaxUint256;
      await contract.set(maxUint256);
      const storedValue = await contract.get();
      expect(storedValue).to.equal(maxUint256);
    });

    it("should handle multiple sequential updates", async function () {
      const values = [1, 5, 10, 15, 20];
      for (const value of values) {
        await contract.set(value);
        const storedValue = await contract.get();
        expect(storedValue).to.equal(value);
      }
    });
  });

  describe("Access Control", function () {
    it("should allow any account to set value", async function () {
      const contractAsOther = contract.connect(otherAccount);
      await contractAsOther.set(42);
      const storedValue = await contract.get();
      expect(storedValue).to.equal(42);
    });
  });
});
