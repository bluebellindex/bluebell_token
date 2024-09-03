// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.20;

library Errors {
    error IncompleteVesting(uint id);
    error ArrayLengthMismatch();
    error InvalidTokenID(uint id);
    error ZeroAmount();
    error Paused();
    error NotAnAdmin(address account);
    error AlreadyAdmin(address account);
}
