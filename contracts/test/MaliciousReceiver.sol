// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../MyToken.sol";

contract MaliciousReceiver {
    MyToken public token;
    uint256 public count;

    constructor(address _token) {
        token = MyToken(_token);
    }

    function attack() external {
        // First, we need some tokens to start the attack
        // The attacker should transfer tokens to this contract first
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "Need tokens to attack");

        // Start the reentrancy attack
        token.transfer(msg.sender, balance);
    }

    // This function will be called by the token contract during transfer
    function onTokenTransfer(address, uint256) external {
        if (count < 2) {
            count++;
            // Try to transfer again while in the middle of a transfer
            token.transfer(msg.sender, 100);
        }
    }
}
