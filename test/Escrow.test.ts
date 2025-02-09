import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ContractTransactionResponse, Signer } from "ethers";
import { Escrow } from "../typechain-types";

describe("Escrow", function () {
  let escrow: Escrow & { deploymentTransaction(): ContractTransactionResponse };
  let buyer: Signer;
  let seller: Signer;
  let arbiter: Signer;
  let other: Signer;

  const AMOUNT = ethers.parseEther("1"); // 1 ETH
  const LOCK_TIME = 7 * 24 * 60 * 60; // 1 week

  beforeEach(async function () {
    [buyer, seller, arbiter, other] = await ethers.getSigners();

    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy(
      await seller.getAddress(),
      await arbiter.getAddress(),
      AMOUNT,
      LOCK_TIME
    );
    await escrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct initial values", async function () {
      expect(await escrow.buyer()).to.equal(await buyer.getAddress());
      expect(await escrow.seller()).to.equal(await seller.getAddress());
      expect(await escrow.arbiter()).to.equal(await arbiter.getAddress());
      expect(await escrow.amount()).to.equal(AMOUNT);
      expect(await escrow.lockTime()).to.equal(LOCK_TIME);
      expect(await escrow.getState()).to.equal("Awaiting Deposit");
    });

    it("should fail with zero amount", async function () {
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      await expect(
        EscrowFactory.deploy(
          await seller.getAddress(),
          await arbiter.getAddress(),
          0,
          LOCK_TIME
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("should fail with zero address", async function () {
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      await expect(
        EscrowFactory.deploy(
          ethers.ZeroAddress,
          await arbiter.getAddress(),
          AMOUNT,
          LOCK_TIME
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });
  });

  describe("Deposit", function () {
    it("should accept correct deposit amount", async function () {
      await expect(escrow.deposit({ value: AMOUNT }))
        .to.emit(escrow, "Deposited")
        .withArgs(await buyer.getAddress(), AMOUNT);

      expect(await escrow.getState()).to.equal("Awaiting Delivery");
    });

    it("should reject incorrect deposit amount", async function () {
      await expect(
        escrow.deposit({ value: AMOUNT - 1n })
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("should reject deposit from non-buyer", async function () {
      await expect(
        escrow.connect(seller).deposit({ value: AMOUNT })
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });

    it("should reject multiple deposits", async function () {
      await escrow.deposit({ value: AMOUNT });
      await expect(
        escrow.deposit({ value: AMOUNT })
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      await escrow.deposit({ value: AMOUNT });
    });

    it("should allow buyer to release funds", async function () {
      await expect(escrow.release())
        .to.emit(escrow, "Released")
        .withArgs(await seller.getAddress(), AMOUNT);

      expect(await escrow.getState()).to.equal("Completed");
    });

    it("should allow automatic release after lockTime", async function () {
      await time.increase(LOCK_TIME + 1);
      await expect(escrow.connect(seller).release())
        .to.emit(escrow, "Released")
        .withArgs(await seller.getAddress(), AMOUNT);
    });

    it("should prevent release from non-buyer before lockTime", async function () {
      await expect(
        escrow.connect(seller).release()
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });
  });

  describe("Refund", function () {
    beforeEach(async function () {
      await escrow.deposit({ value: AMOUNT });
    });

    it("should allow buyer to refund before lockTime", async function () {
      await expect(escrow.refund())
        .to.emit(escrow, "Refunded")
        .withArgs(await buyer.getAddress(), AMOUNT);

      expect(await escrow.getState()).to.equal("Refunded");
    });

    it("should prevent refund after lockTime", async function () {
      await time.increase(LOCK_TIME + 1);
      await expect(escrow.refund()).to.be.revertedWithCustomError(
        escrow,
        "InvalidState"
      );
    });

    it("should prevent refund from non-buyer", async function () {
      await expect(
        escrow.connect(seller).refund()
      ).to.be.revertedWithCustomError(escrow, "NotBuyer");
    });
  });

  describe("Dispute Resolution", function () {
    beforeEach(async function () {
      await escrow.deposit({ value: AMOUNT });
    });

    it("should allow buyer to raise dispute", async function () {
      await expect(escrow.raiseDispute("Item not received"))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(await buyer.getAddress(), "Item not received");

      expect(await escrow.getState()).to.equal("Disputed");
    });

    it("should allow seller to raise dispute", async function () {
      await expect(escrow.connect(seller).raiseDispute("Payment issue"))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(await seller.getAddress(), "Payment issue");
    });

    it("should prevent non-parties from raising dispute", async function () {
      await expect(
        escrow.connect(other).raiseDispute("Random dispute")
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    describe("Dispute Resolution", function () {
      beforeEach(async function () {
        await escrow.raiseDispute("Test dispute");
      });

      it("should allow arbiter to resolve in favor of buyer", async function () {
        await expect(
          escrow.connect(arbiter).resolveDispute(await buyer.getAddress())
        )
          .to.emit(escrow, "DisputeResolved")
          .withArgs(await buyer.getAddress(), AMOUNT);

        expect(await escrow.getState()).to.equal("Refunded");
      });

      it("should allow arbiter to resolve in favor of seller", async function () {
        await expect(
          escrow.connect(arbiter).resolveDispute(await seller.getAddress())
        )
          .to.emit(escrow, "DisputeResolved")
          .withArgs(await seller.getAddress(), AMOUNT);

        expect(await escrow.getState()).to.equal("Completed");
      });

      it("should prevent non-arbiter from resolving dispute", async function () {
        await expect(
          escrow.connect(other).resolveDispute(await buyer.getAddress())
        ).to.be.revertedWithCustomError(escrow, "NotArbiter");
      });

      it("should prevent resolving to invalid address", async function () {
        await expect(
          escrow.connect(arbiter).resolveDispute(await other.getAddress())
        ).to.be.revertedWithCustomError(escrow, "InvalidState");
      });
    });
  });

  describe("View Functions", function () {
    it("should correctly report canRelease status", async function () {
      expect(await escrow.canRelease()).to.be.false;

      await escrow.deposit({ value: AMOUNT });
      expect(await escrow.canRelease()).to.be.true;

      await time.increase(LOCK_TIME + 1);
      expect(await escrow.connect(seller).canRelease()).to.be.true;
    });

    it("should correctly report canRefund status", async function () {
      expect(await escrow.canRefund()).to.be.false;

      await escrow.deposit({ value: AMOUNT });
      expect(await escrow.canRefund()).to.be.true;

      await time.increase(LOCK_TIME + 1);
      expect(await escrow.canRefund()).to.be.false;
    });
  });
});
