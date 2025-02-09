// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error CampaignNotActive();
error DeadlineNotReached();
error DeadlineReached();
error GoalReached();
error GoalNotReached();
error NotOwner();
error ContributionTooLow();
error NoContribution();
error TransferFailed();
error AlreadyFinalized();

contract Crowdfunding {
    // State variables
    address public owner;
    uint256 public goal;
    uint256 public raisedAmount;
    uint256 public deadline;
    uint256 public minContribution;
    uint256 public contributorsCount;
    bool public finalized;

    // Mappings
    mapping(address => uint256) public contributions;
    mapping(address => bool) private hasContributed;

    // Events
    event ContributionReceived(address indexed contributor, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event CampaignFinalized(uint256 raisedAmount, bool successful);
    event CampaignCanceled();

    // Reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        if (_status == _ENTERED) revert("ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier campaignActive() {
        if (block.timestamp >= deadline) revert DeadlineReached();
        if (finalized) revert AlreadyFinalized();
        _;
    }

    constructor(uint256 _goal, uint256 _duration, uint256 _minContribution) {
        if (_goal == 0) revert("Goal must be greater than 0");
        if (_duration == 0) revert("Duration must be greater than 0");

        owner = msg.sender;
        goal = _goal;
        deadline = block.timestamp + _duration;
        minContribution = _minContribution;
        _status = _NOT_ENTERED;
    }

    function contribute() public payable campaignActive {
        if (msg.value < minContribution) revert ContributionTooLow();

        if (!hasContributed[msg.sender]) {
            hasContributed[msg.sender] = true;
            contributorsCount++;
        }

        contributions[msg.sender] += msg.value;
        raisedAmount += msg.value;

        emit ContributionReceived(msg.sender, msg.value);
    }

    function refund() public nonReentrant {
        if (block.timestamp <= deadline) revert DeadlineNotReached();
        if (raisedAmount >= goal) revert GoalReached();

        uint256 contributedAmount = contributions[msg.sender];
        if (contributedAmount == 0) revert NoContribution();

        contributions[msg.sender] = 0;
        if (hasContributed[msg.sender]) {
            hasContributed[msg.sender] = false;
            contributorsCount--;
        }

        emit RefundIssued(msg.sender, contributedAmount);

        (bool success, ) = payable(msg.sender).call{value: contributedAmount}(
            ""
        );
        if (!success) revert TransferFailed();
    }

    function finalize() public nonReentrant onlyOwner {
        if (block.timestamp <= deadline) revert DeadlineNotReached();
        if (finalized) revert AlreadyFinalized();

        finalized = true;
        bool campaignSuccessful = raisedAmount >= goal;

        emit CampaignFinalized(raisedAmount, campaignSuccessful);

        if (campaignSuccessful) {
            (bool success, ) = payable(owner).call{value: raisedAmount}("");
            if (!success) revert TransferFailed();
        }
    }

    function cancelCampaign() public onlyOwner campaignActive {
        finalized = true;
        emit CampaignCanceled();
    }

    // View functions
    function getRemainingTime() public view returns (uint256) {
        return block.timestamp < deadline ? deadline - block.timestamp : 0;
    }

    function getContributorCount() public view returns (uint256) {
        return contributorsCount;
    }

    function getCampaignStatus() public view returns (string memory) {
        if (finalized) return "Finalized";
        if (block.timestamp >= deadline) return "Ended";
        return "Active";
    }

    function isGoalReached() public view returns (bool) {
        return raisedAmount >= goal;
    }
}
