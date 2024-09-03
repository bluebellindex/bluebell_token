// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "./Errors.sol";

contract ERC1155Vesting is ERC1155Burnable, ERC1155Supply {
    // each token has a schedule (timestamp) for anyone to transfer them.
    // buyer -> id -> timestamp.
    mapping(address => mapping(uint256 => uint256)) public vestingSchedules;

    constructor(string memory _uri) ERC1155(_uri) {}

    ///@notice the mintToken function is flexible enough to allow minting of the tokens directly to the buyer or allowing minting only to the admins with or without any `lockup`.
    /// @dev if the minting is for an admin who doesnt want to be restricted by the releaseTime, a releaseTime of 0 can be used.
    ///@param id the id of the token to be minted.
    ///@param amount the amount of the token to be minted.
    ///@param to the address for whom the token is to be minted.
    ///@param releaseTime the release time before which the token cannot be transferred by a common user.
    function mintToken(
        uint256 id,
        uint256 amount,
        address to,
        uint256 releaseTime
    ) public virtual {
        vestingSchedules[to][id] = releaseTime;
        _mint(to, id, amount, "");
    }

    ///@notice the mintBatch function is flexible enough to allow minting of the tokens directly to the buyer or allowing minting only to the admins with or without any `lockup`.
    /// @dev if the minting is for an admin who doesnt want to be restricted by the releaseTime, a releaseTime array of 0 valued elements can be used.
    ///@param ids the ids of the token to be minted.
    ///@param amounts the amounts of the token to be minted.
    ///@param to the address for whom the token is to be minted.
    ///@param releaseTimes the release times before which the token cannot be transferred by a common user.
    function mintBatch(
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256[] calldata releaseTimes
    ) public virtual {
        uint length = ids.length;
        for (uint i; i < length; ) {
            vestingSchedules[to][ids[i]] = releaseTimes[i];
            unchecked {
                ++i;
            }
        }

        _mintBatch(to, ids, amounts, "");
    }

    ///@notice this function is internal because it is only called inside the `adminTransfer` function. A public entrypoing is given in the `modifyReleaseTime` function.
    /// @dev since this function will only be called by `adminTransfer`, the checks on the arrays have been done already.
    /// @param users users for which release times will be set.
    /// @param ids tokens for which release times will be set.
    /// @param releaseTimes release times to be set.
    function setReleaseTimes(
        address[] memory users,
        uint256[] memory ids,
        uint256[] memory releaseTimes
    ) internal {
        uint length = users.length;
        for (uint i; i < length; ) {
            vestingSchedules[users[i]][ids[i]] = releaseTimes[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice it changes the release time for specific token `ids`. The release time can be anytime, including times in the past.
    /// @param ids the tokens for times to be changed for.
    /// @param releaseTimes the new times to be applied for these tokens.
    /// @param users the users for which releaseTime will be changed.
    function modifyReleaseTime(
        address[] calldata users,
        uint256[] calldata ids,
        uint256[] calldata releaseTimes
    ) public virtual {
        uint length = ids.length == releaseTimes.length &&
            releaseTimes.length == users.length
            ? ids.length
            : 0;
        if (length == 0) revert Errors.ArrayLengthMismatch();

        for (uint i; i < length; ) {
            vestingSchedules[users[i]][ids[i]] = releaseTimes[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice it sets the releaseTimes for users and ids given to 0.
    /// @param users the users for which we will set the releaseTimes to 0.
    /// @param ids the tokens that will have their releaseTime set to 0.
    function endReleaseTime(
        address[] calldata users,
        uint256[] calldata ids
    ) public virtual {
        uint length = ids.length == users.length ? ids.length : 0;
        if (length == 0) revert Errors.ArrayLengthMismatch();
        for (uint i; i < length; ) {
            // reset the time for a specific id.
            delete vestingSchedules[users[i]][ids[i]];
            unchecked {
                ++i;
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////TRANSFER TOKENS FUNCTIONS///////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////
    /// @notice it transfers an amount of a single token from an account to another.
    /// @param from account from which the tokens are to be transferred from.
    /// @param to account to which the tokena are to be transferred to.
    /// @param id id of token that is be to transferred.
    /// @param amount amount of the specific token to be transferred.
    /// @param data a data parameter to specify the transfer, if needed.
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not token owner or approved"
        );

        _safeTransferFrom(from, to, id, amount, data);
    }

    /// @notice it transfer multiple amounts of different tokens from an account to another.
    /// @param from the account from which the tokens will be transferred.
    /// @param to the account who will receive the tokens.
    /// @param ids the ids that will be transferred.
    /// @param amounts the amounts of each id that will be transferred.
    /// @param data a data parameter to specify the transfer, if needed.
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not token owner or approved"
        );
        _safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    /// @notice this must depend only on the `id` of the token, regarless the account that's trying to transfer, unless admin.
    /// @param id id of token to be transferred.
    /// @dev the vesting should restrict the days any user can transfer them.
    /// @dev the vesting should allow only the admins to transfer the tokens beforehand, therefore it is not check on them.
    function _isVestingComplete(
        address who,
        uint256 id
    ) internal view returns (bool) {
        uint256 schedule = vestingSchedules[who][id];
        return block.timestamp >= schedule;
    }

    function checkVestingSchedule(
        address user,
        uint[] memory ids
    ) internal view virtual {
        uint length = ids.length;
        for (uint i; i < length; ) {
            if (!_isVestingComplete(user, ids[i]))
                revert Errors.IncompleteVesting(ids[i]);
            unchecked {
                ++i;
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////NEEDED FUNCTIONS//////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155, ERC1155Supply) {
        /// @dev using Supply instead of ERC1155 makes the update increase the `totalSupply` for a token, which is ESSENTIAL for the `exists` function to function.
        ERC1155Supply._update(from, to, ids, values);
    }
}
