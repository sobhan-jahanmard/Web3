// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public greeting = "Hello World";

    function setGreeting(string memory newGreeting) public {
        greeting = newGreeting;
    }
}
