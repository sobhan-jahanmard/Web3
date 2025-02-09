// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error NotBuyer();
error NotSeller();
error NotArbiter();
error InvalidState();
error InvalidAmount();
error TransferFailed();
error DisputeAlreadyRaised();
error NoDispute();
error InsufficientDeposit();

contract Escrow {
    // Participants
    address public buyer;
    address public seller;
    address public arbiter;

    // Payment details
    uint256 public amount;
    uint256 public lockTime;
    uint256 public depositTime;

    // State management
    enum State {
        AWAITING_DEPOSIT,
        AWAITING_DELIVERY,
        DISPUTED,
        COMPLETED,
        REFUNDED
    }
    State public currentState;

    // Events
    event Deposited(address indexed buyer, uint256 amount);
    event Released(address indexed seller, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);
    event DisputeRaised(address indexed raiser, string reason);
    event DisputeResolved(address indexed winner, uint256 amount);

    // Reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyBuyer() {
        if (msg.sender != buyer) revert NotBuyer();
        _;
    }

    modifier onlySeller() {
        if (msg.sender != seller) revert NotSeller();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert NotArbiter();
        _;
    }

    modifier inState(State state) {
        if (currentState != state) revert InvalidState();
        _;
    }

    constructor(
        address _seller,
        address _arbiter,
        uint256 _amount,
        uint256 _lockTime
    ) {
        if (_amount == 0) revert InvalidAmount();
        if (_seller == address(0) || _arbiter == address(0))
            revert InvalidAmount();

        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        amount = _amount;
        lockTime = _lockTime;
        currentState = State.AWAITING_DEPOSIT;
        _status = _NOT_ENTERED;
    }

    function deposit()
        external
        payable
        onlyBuyer
        inState(State.AWAITING_DEPOSIT)
    {
        if (msg.value != amount) revert InvalidAmount();

        currentState = State.AWAITING_DELIVERY;
        depositTime = block.timestamp;

        emit Deposited(buyer, msg.value);
    }

    function release() external nonReentrant {
        // Can be called by buyer or automatically after lockTime
        if (msg.sender != buyer && block.timestamp < depositTime + lockTime) {
            revert NotBuyer();
        }
        if (currentState != State.AWAITING_DELIVERY) revert InvalidState();

        currentState = State.COMPLETED;

        (bool success, ) = payable(seller).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Released(seller, amount);
    }

    function refund()
        external
        nonReentrant
        onlyBuyer
        inState(State.AWAITING_DELIVERY)
    {
        // Only buyer can request refund before lockTime
        if (block.timestamp >= depositTime + lockTime) revert InvalidState();

        currentState = State.REFUNDED;

        (bool success, ) = payable(buyer).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Refunded(buyer, amount);
    }

    function raiseDispute(string calldata reason) external {
        if (msg.sender != buyer && msg.sender != seller) revert InvalidState();
        if (currentState != State.AWAITING_DELIVERY) revert InvalidState();

        currentState = State.DISPUTED;
        emit DisputeRaised(msg.sender, reason);
    }

    function resolveDispute(
        address payable winner
    ) external nonReentrant onlyArbiter inState(State.DISPUTED) {
        if (winner != buyer && winner != seller) revert InvalidState();

        currentState = winner == buyer ? State.REFUNDED : State.COMPLETED;

        (bool success, ) = winner.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit DisputeResolved(winner, amount);
    }

    // View functions
    function getState() external view returns (string memory) {
        if (currentState == State.AWAITING_DEPOSIT) return "Awaiting Deposit";
        if (currentState == State.AWAITING_DELIVERY) return "Awaiting Delivery";
        if (currentState == State.DISPUTED) return "Disputed";
        if (currentState == State.COMPLETED) return "Completed";
        return "Refunded";
    }

    function canRelease() external view returns (bool) {
        return
            currentState == State.AWAITING_DELIVERY &&
            (msg.sender == buyer || block.timestamp >= depositTime + lockTime);
    }

    function canRefund() external view returns (bool) {
        return
            currentState == State.AWAITING_DELIVERY &&
            msg.sender == buyer &&
            block.timestamp < depositTime + lockTime;
    }
}
