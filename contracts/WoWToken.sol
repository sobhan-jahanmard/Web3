// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WoWToken is ERC20, ERC20Permit, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10 ** 18; // 1 million tokens with 18 decimals

    constructor(
        address initialOwner
    )
        ERC20("WoW", "WoW")
        ERC20Permit("WoW")
        Ownable(initialOwner) // Pass the initialOwner to Ownable
    {
        // Mint the initial supply to the initial owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    // Getter function for the initial supply
    function getInitialSupply() external pure returns (uint256) {
        return INITIAL_SUPPLY;
    }

    // Mint new tokens (only the owner can do this)
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Burn tokens (anyone can burn their own tokens)
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
