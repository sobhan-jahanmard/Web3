import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ContractTransactionResponse, Signer } from "ethers";
import { Crowdfunding } from "../typechain-types";

describe("Crowdfunding", function () {
  let crowdfunding: Crowdfunding & {
    deploymentTransaction(): ContractTransactionResponse;
  };
  let owner: Signer;
  let contributor1: Signer;
  let contributor2: Signer;
  let contributors: Signer[];

  const GOAL = ethers.parseEther("10"); // 10 ETH
  const DURATION = 7 * 24 * 60 * 60; // 1 week
  const MIN_CONTRIBUTION = ethers.parseEther("0.1"); // 0.1 ETH

  beforeEach(async function () {
    [owner, contributor1, contributor2, ...contributors] =
      await ethers.getSigners();

    const CrowdfundingFactory = await ethers.getContractFactory("Crowdfunding");
    crowdfunding = await CrowdfundingFactory.deploy(
      GOAL,
      DURATION,
      MIN_CONTRIBUTION
    );
    await crowdfunding.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await crowdfunding.owner()).to.equal(await owner.getAddress());
    });

    it("should set the correct goal", async function () {
      expect(await crowdfunding.goal()).to.equal(GOAL);
    });

    it("should set the correct minimum contribution", async function () {
      expect(await crowdfunding.minContribution()).to.equal(MIN_CONTRIBUTION);
    });

    it("should fail with zero goal", async function () {
      const CrowdfundingFactory = await ethers.getContractFactory(
        "Crowdfunding"
      );
      await expect(
        CrowdfundingFactory.deploy(0, DURATION, MIN_CONTRIBUTION)
      ).to.be.revertedWith("Goal must be greater than 0");
    });

    it("should fail with zero duration", async function () {
      const CrowdfundingFactory = await ethers.getContractFactory(
        "Crowdfunding"
      );
      await expect(
        CrowdfundingFactory.deploy(GOAL, 0, MIN_CONTRIBUTION)
      ).to.be.revertedWith("Duration must be greater than 0");
    });
  });

  describe("Contributions", function () {
    it("should accept valid contributions", async function () {
      const contribution = MIN_CONTRIBUTION;
      await crowdfunding
        .connect(contributor1)
        .contribute({ value: contribution });

      expect(
        await crowdfunding.contributions(await contributor1.getAddress())
      ).to.equal(contribution);
      expect(await crowdfunding.raisedAmount()).to.equal(contribution);
      expect(await crowdfunding.contributorsCount()).to.equal(1);
    });

    it("should emit ContributionReceived event", async function () {
      const contribution = MIN_CONTRIBUTION;
      await expect(
        crowdfunding.connect(contributor1).contribute({ value: contribution })
      )
        .to.emit(crowdfunding, "ContributionReceived")
        .withArgs(await contributor1.getAddress(), contribution);
    });

    it("should reject contributions below minimum", async function () {
      await expect(
        crowdfunding.connect(contributor1).contribute({
          value: MIN_CONTRIBUTION - 1n,
        })
      ).to.be.revertedWithCustomError(crowdfunding, "ContributionTooLow");
    });

    it("should track multiple contributions from same address", async function () {
      await crowdfunding
        .connect(contributor1)
        .contribute({ value: MIN_CONTRIBUTION });
      await crowdfunding
        .connect(contributor1)
        .contribute({ value: MIN_CONTRIBUTION });

      expect(
        await crowdfunding.contributions(await contributor1.getAddress())
      ).to.equal(MIN_CONTRIBUTION * 2n);
      expect(await crowdfunding.contributorsCount()).to.equal(1);
    });

    it("should reject contributions after deadline", async function () {
      await time.increase(DURATION + 1);
      await expect(
        crowdfunding
          .connect(contributor1)
          .contribute({ value: MIN_CONTRIBUTION })
      ).to.be.revertedWithCustomError(crowdfunding, "DeadlineReached");
    });
  });

  describe("Refunds", function () {
    beforeEach(async function () {
      await crowdfunding.connect(contributor1).contribute({
        value: ethers.parseEther("1"),
      });
    });

    it("should not allow refunds before deadline", async function () {
      await expect(
        crowdfunding.connect(contributor1).refund()
      ).to.be.revertedWithCustomError(crowdfunding, "DeadlineNotReached");
    });

    it("should not allow refunds if goal was reached", async function () {
      await crowdfunding.connect(contributor2).contribute({ value: GOAL });
      await time.increase(DURATION + 1);

      await expect(
        crowdfunding.connect(contributor1).refund()
      ).to.be.revertedWithCustomError(crowdfunding, "GoalReached");
    });

    it("should process valid refund requests", async function () {
      await time.increase(DURATION + 1);
      const initialBalance = await ethers.provider.getBalance(
        await contributor1.getAddress()
      );

      await expect(crowdfunding.connect(contributor1).refund())
        .to.emit(crowdfunding, "RefundIssued")
        .withArgs(await contributor1.getAddress(), ethers.parseEther("1"));

      expect(
        await crowdfunding.contributions(await contributor1.getAddress())
      ).to.equal(0);
      expect(await crowdfunding.contributorsCount()).to.equal(0);
    });
  });

  describe("Finalization", function () {
    beforeEach(async function () {
      await crowdfunding.connect(contributor1).contribute({
        value: GOAL,
      });
    });

    it("should only allow owner to finalize", async function () {
      await time.increase(DURATION + 1);
      await expect(
        crowdfunding.connect(contributor1).finalize()
      ).to.be.revertedWithCustomError(crowdfunding, "NotOwner");
    });

    it("should not allow finalization before deadline", async function () {
      await expect(
        crowdfunding.connect(owner).finalize()
      ).to.be.revertedWithCustomError(crowdfunding, "DeadlineNotReached");
    });

    it("should transfer funds to owner on successful campaign", async function () {
      await time.increase(DURATION + 1);
      const initialBalance = await ethers.provider.getBalance(
        await owner.getAddress()
      );

      await expect(crowdfunding.connect(owner).finalize())
        .to.emit(crowdfunding, "CampaignFinalized")
        .withArgs(GOAL, true);
    });

    it("should not allow multiple finalizations", async function () {
      await time.increase(DURATION + 1);
      await crowdfunding.connect(owner).finalize();

      await expect(
        crowdfunding.connect(owner).finalize()
      ).to.be.revertedWithCustomError(crowdfunding, "AlreadyFinalized");
    });
  });

  describe("Campaign Cancellation", function () {
    it("should allow owner to cancel active campaign", async function () {
      await expect(crowdfunding.connect(owner).cancelCampaign()).to.emit(
        crowdfunding,
        "CampaignCanceled"
      );
      expect(await crowdfunding.finalized()).to.be.true;
    });

    it("should not allow non-owner to cancel", async function () {
      await expect(
        crowdfunding.connect(contributor1).cancelCampaign()
      ).to.be.revertedWithCustomError(crowdfunding, "NotOwner");
    });

    it("should not allow contributions after cancellation", async function () {
      await crowdfunding.connect(owner).cancelCampaign();
      await expect(
        crowdfunding
          .connect(contributor1)
          .contribute({ value: MIN_CONTRIBUTION })
      ).to.be.revertedWithCustomError(crowdfunding, "AlreadyFinalized");
    });
  });

  describe("View Functions", function () {
    it("should return correct remaining time", async function () {
      const remainingTime = await crowdfunding.getRemainingTime();
      expect(remainingTime).to.be.closeTo(BigInt(DURATION), 5n);
    });

    it("should return correct campaign status", async function () {
      expect(await crowdfunding.getCampaignStatus()).to.equal("Active");

      await crowdfunding.connect(owner).cancelCampaign();
      expect(await crowdfunding.getCampaignStatus()).to.equal("Finalized");

      await time.increase(DURATION + 1);
      expect(await crowdfunding.getCampaignStatus()).to.equal("Finalized");
    });

    it("should correctly track goal reached status", async function () {
      expect(await crowdfunding.isGoalReached()).to.be.false;

      await crowdfunding.connect(contributor1).contribute({ value: GOAL });
      expect(await crowdfunding.isGoalReached()).to.be.true;
    });
  });
});
