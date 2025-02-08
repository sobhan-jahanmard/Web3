import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractTransactionResponse, Signer } from "ethers";
import { MyToken } from "../typechain-types";

describe("MyToken", function () {
  let token: MyToken & { deploymentTransaction(): ContractTransactionResponse };
  let tempToken: MyToken & {
    deploymentTransaction(): ContractTransactionResponse;
  };
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;
  let addrs: Signer[];
  const INITIAL_SUPPLY = 1000;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    const TokenFactory = await ethers.getContractFactory("MyToken");
    token = await TokenFactory.deploy(INITIAL_SUPPLY);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct token metadata", async function () {
      expect(await token.name()).to.equal("MyToken");
      expect(await token.symbol()).to.equal("MTK");
      expect(await token.decimals()).to.equal(18);
    });

    it("should assign the total supply to the owner", async function () {
      const ownerBalance = await token.balanceOf(await owner.getAddress());
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("should revert if deployed with zero initial supply", async function () {
      const TokenFactory = await ethers.getContractFactory("MyToken");

      await expect(TokenFactory.deploy(0)).to.be.revertedWithCustomError(
        await TokenFactory.deploy(INITIAL_SUPPLY),
        "InvalidAmount"
      );
    });
  });

  describe("Transfers", function () {
    it("should transfer tokens between accounts", async function () {
      const amount = 50n * 10n ** 18n;
      await token.transfer(await addr1.getAddress(), amount);

      expect(await token.balanceOf(await addr1.getAddress())).to.equal(amount);

      await token.connect(addr1).transfer(await addr2.getAddress(), amount);

      expect(await token.balanceOf(await addr1.getAddress())).to.equal(0);
      expect(await token.balanceOf(await addr2.getAddress())).to.equal(amount);
    });

    it("should fail if sender doesn't have enough tokens", async function () {
      await expect(
        token.connect(addr1).transfer(await owner.getAddress(), 1)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("should fail if transferring to zero address", async function () {
      await expect(
        token.transfer(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(token, "TransferToZeroAddress");
    });

    it("should fail if transferring zero amount", async function () {
      await expect(
        token.transfer(await addr1.getAddress(), 0)
      ).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("Allowances", function () {
    const amount = 100n * 10n ** 18n;

    it("should approve spending and update allowance", async function () {
      await token.approve(await addr1.getAddress(), amount);
      expect(
        await token.allowance(
          await owner.getAddress(),
          await addr1.getAddress()
        )
      ).to.equal(amount);
    });

    it("should fail when approving zero address", async function () {
      await expect(
        token.approve(ethers.ZeroAddress, amount)
      ).to.be.revertedWithCustomError(token, "ApproveToZeroAddress");
    });

    describe("TransferFrom", function () {
      beforeEach(async function () {
        await token.approve(await addr1.getAddress(), amount);
      });

      it("should transfer tokens using allowance", async function () {
        await token
          .connect(addr1)
          .transferFrom(
            await owner.getAddress(),
            await addr2.getAddress(),
            amount
          );

        expect(await token.balanceOf(await addr2.getAddress())).to.equal(
          amount
        );
        expect(
          await token.allowance(
            await owner.getAddress(),
            await addr1.getAddress()
          )
        ).to.equal(0);
      });

      it("should fail if trying to transfer more than allowed", async function () {
        await expect(
          token
            .connect(addr1)
            .transferFrom(
              await owner.getAddress(),
              await addr2.getAddress(),
              amount + 1n
            )
        ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
      });

      it("should fail if owner has insufficient balance despite allowance", async function () {
        // Transfer all tokens from owner to addr2
        const ownerBalance = await token.balanceOf(await owner.getAddress());
        await token.transfer(await addr2.getAddress(), ownerBalance);

        // Try to use allowance
        await expect(
          token
            .connect(addr1)
            .transferFrom(
              await owner.getAddress(),
              await addr2.getAddress(),
              amount
            )
        ).to.be.revertedWithCustomError(token, "InsufficientBalance");
      });
    });

    describe("Allowance Modifications", function () {
      it("should increase allowance correctly", async function () {
        await token.approve(await addr1.getAddress(), amount);
        await token.increaseAllowance(await addr1.getAddress(), amount);

        expect(
          await token.allowance(
            await owner.getAddress(),
            await addr1.getAddress()
          )
        ).to.equal(amount * 2n);
      });

      it("should decrease allowance correctly", async function () {
        await token.approve(await addr1.getAddress(), amount);
        await token.decreaseAllowance(await addr1.getAddress(), amount / 2n);

        expect(
          await token.allowance(
            await owner.getAddress(),
            await addr1.getAddress()
          )
        ).to.equal(amount / 2n);
      });

      it("should fail when decreasing allowance below zero", async function () {
        await token.approve(await addr1.getAddress(), amount);
        await expect(
          token.decreaseAllowance(await addr1.getAddress(), amount + 1n)
        ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
      });
    });
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy attacks through onTokenTransfer", async function () {
      // Deploy the malicious contract
      const MaliciousReceiver = await ethers.getContractFactory(
        "MaliciousReceiver"
      );
      const maliciousContract = await MaliciousReceiver.deploy(
        await token.getAddress()
      );
      await maliciousContract.waitForDeployment();

      // Fund the malicious contract with initial tokens
      const attackAmount = 1n * 10n ** 18n;
      expect(
        token.transfer(await maliciousContract.getAddress(), attackAmount)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });
  });
});
