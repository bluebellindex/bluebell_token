// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utils/ERC1155Vesting.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./utils/Errors.sol";

/// @title BluebellToken
/// @author Caio Sá Barros
/// @notice Basic ERC1155 token implementation with custom multisig functionality

contract BluebellToken is ERC1155Vesting, ReentrancyGuard, AccessControl {
    ///@dev function signature -> encoded parameters -> admin -> approved
    mapping(bytes4 => mapping(bytes => mapping(address => bool)))
        public pendingApprovalsFromAdmins;

    ///@dev helper mapping to get admins index on array of admins.
    mapping(address => uint256) private adminIndexes;

    // collection name
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    string public baseURI;
    string public name = "Bluebell";
    address[] public admins;
    uint256[] public mintedIDs;
    uint256 public adminsLength;
    bool public isMultisigEnabled;
    bool public paused;

    /**
     * @dev This variable below is crucial for determining how many admins have to make the same call so that a function that requires multisig (mint/burn funcionalities) can be called.
     */
    uint256 public minimumApprovalsNumber;

    // events: the events related to role granting/revoking are emitted by the AccessControl contract.
    event MintToken(address user, uint256 tokenID, uint256 amount);
    event MintBatch(address user, uint256[] ids, uint256[] amount);
    event BurnToken(address from, uint256 id, uint256 amount);
    event BurnBatch(address indexed from, uint256[] ids, uint256[] values);

    // for efficiently storing the calls alreay made on the blockchain, we'll use the event below
    event MultisigCallUpdated(bytes4 selector, bytes params, address admin);

    /**
    @dev It accepts the signature and the encoded params of the called function. It executes the function with the specified params if minimumApprovalsNumber has been reached. Only useful if isMultisigEnabled is true.
    */
    modifier checkMultisigApproval(bytes4 sig, bytes memory params) {
        if (isMultisigEnabled) {
            updatePendingApproval(sig, params, _msgSender());
            if (checkPendingApproval(sig, params)) {
                _; //call function in here
                // resetCall to avoid a malicious "required+1" call
                resetPendingFunctionCall(sig, params);
            }
        } else {
            _;
        }
    }

    /// constructor: it grants the ADMIN_ROLE for the accounts in the _admins array and it adds each of them onto the admins array. If the deployer wants to be added to the admins array & receive the ADMIN_ROLE, it may pass itself in the constructor or it might do it later through the grantRole function. It is marked as payable to reduce some deployment costs.
    /// @param _admins array of admins to receive the ADMIN_ROLE and approve the calls if multisig is enabled.
    /// @param _baseURI baseURI for contract's tokens.
    /// @param _minimumApprovalsNumber minimum of admins to have if multisig is enabled.
    constructor(
        address[] memory _admins,
        string memory _baseURI,
        uint _minimumApprovalsNumber
    ) payable ERC1155Vesting(_baseURI) {
        baseURI = _baseURI;

        //grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender()); // deployer will be goBlockchain, who can in turn give DEFAULT to someone.

        //add admins
        uint256 _adminsLength = _admins.length;

        for (uint256 i = 0; i < _adminsLength; ) {
            grantRole(ADMIN_ROLE, _admins[i]);
            unchecked {
                ++i;
            }
        }
        // update admins length
        _updateAdminsLength(_adminsLength);

        // it sets the minimum number of approvals to 3.
        minimumApprovalsNumber = _minimumApprovalsNumber;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////MULTISIG FUNCTIONS////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /// @notice it creates or updates a new or pending call.
    /// @param sig: function signature to be called.
    /// @param params: encoded params for function of sig sig to be called.
    /// @param admin: admin that has approved the call for `sig` with the `params`.
    function updatePendingApproval(
        bytes4 sig,
        bytes memory params,
        address admin
    ) internal {
        //updates or creates mapping for this specific call.
        pendingApprovalsFromAdmins[sig][params][admin] = true;
        emit MultisigCallUpdated(sig, params, admin);
    }

    /// @notice it checks if a pending call is already good to be executed. It's not possible for a admin to make three calls and get the tx approved, since the loop tracks each admin instead of the amount of calls made.
    /// @param sig: function signature to be called.
    /// @param params: encoded params for function of sig `sig` to be called.
    function checkPendingApproval(
        bytes4 sig,
        bytes memory params
    ) internal view returns (bool) {
        uint256 approvals;
        for (uint256 i = 0; i < adminsLength; ) {
            bool hasApproved = pendingApprovalsFromAdmins[sig][params][
                admins[i]
            ];
            if (hasApproved) ++approvals;
            unchecked {
                ++i;
            }
        }
        return approvals >= minimumApprovalsNumber; //it means the bare minimum admins have approved
    }

    /// @notice it goes through all admins and set their approvals to false, avoiding any "fourth" malicious call by an admin.
    /// @param sig: function signature for which we'll reset the approvals.
    /// @param params: encoded params for function we'll reset approvals.
    function resetPendingFunctionCall(
        bytes4 sig,
        bytes memory params
    ) internal returns (bool) {
        require(isMultisigEnabled, "!isMultisigEnabled");
        for (uint256 i = 0; i < adminsLength; ) {
            pendingApprovalsFromAdmins[sig][params][admins[i]] = false;
            unchecked {
                ++i;
            }
        }
        return true;
    }

    /// @notice it sets the number of different accounts that need to approve a transaction. If it's 1, then the contract will behave as a single-sig contract, though the multisig may be enabled.
    /// @param _minimumApprovalsNumber: the minimum number of different admins that will need to make the same transaction.
    function changeMinimumApprovalsNumber(
        uint256 _minimumApprovalsNumber
    ) public onlyRole(ADMIN_ROLE) returns (uint256) {
        require(isMultisigEnabled, "enable multsig first");
        minimumApprovalsNumber = _minimumApprovalsNumber;
        return minimumApprovalsNumber;
    }

    /// @notice it makes all the admins to have approval over an account's tokens.
    /// @param _to account to which all admins will have approvals over.
    function makeAllAdminsApproved(address _to) internal {
        for (uint i = 0; i < adminsLength; ) {
            if (!isApprovedForAll(_to, admins[i]) && admins[i] != _to)
                _setApprovalForAll(_to, admins[i], true);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice overriding setApprovalForAll so that all admins can be able to burn the tokens in multsig. If not like this, we'll get a "not approved" exception if the last admin to call the burn function isn't approved. So, order would matter, which would bring in limitations to the protocol.
    /// @param operator who's the caller is approving.
    /// @param approved  the approval flag the caller gives/revokes to the operator.
    function setApprovalForAll(
        address operator,
        bool approved
    ) public override {
        // approves for operator normally
        super.setApprovalForAll(operator, approved);
        // approves for all the admins
        for (uint i = 0; i < adminsLength; ) {
            // admins[i]!=_msgSender() to avoid: approval for self
            if (
                !isApprovedForAll(_msgSender(), admins[i]) &&
                admins[i] != _msgSender()
            ) _setApprovalForAll(_msgSender(), admins[i], approved);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice it grants a role for an account.
    /// @dev if role is ADMIN_ROLE, the account will be automatically be added onto the `admins` array.
    /// @param role the new address to be added as a admin.
    /// @param account the new address to be added as a admin.
    function grantRole(
        bytes32 role,
        address account
    ) public override onlyRole(getRoleAdmin(role)) {
        // add to the trackable admins array
        if (role == ADMIN_ROLE) addAdmin(account);

        // actually grant the role
        _grantRole(role, account);
    }

    /// @notice it adds an account onto the admin array and avoids any duplicate accounts on the `admins` array.
    /// @param account the account that will be added onto the admins array.
    function addAdmin(address account) internal {
        // avoid same account multiple times in the array.
        if (hasRole(ADMIN_ROLE, account)) revert Errors.AlreadyAdmin(account);
        admins.push(account);
        adminIndexes[account] = (admins.length - 1);
        _updateAdminsLength(admins.length);
    }

    /// @notice it revokes a role from an account.
    /// @param role role to be revoked.
    /// @param account address to receive the role.
    function revokeRole(
        bytes32 role,
        address account
    ) public override onlyRole(getRoleAdmin(role)) {
        // remove from admins array
        if (role == ADMIN_ROLE) removeAdmin(account);
        // revoke the role
        _revokeRole(role, account);
    }

    /// @notice it removes an account from the `admins` array and updates the adminIndexes mapping
    /// @dev it removes an admin from the array without adding the address(0) as admin.
    /// @param account the address to be removed from the array.
    function removeAdmin(address account) internal {
        uint _index = adminIndexes[account];

        // loop to cleanly delete the account to be removed.
        // cleanly means: remove only the account from the array regardless its index

        for (uint i = _index; i < adminsLength; ) {
            if (i + 1 == admins.length) {
                // we assign the last element of the array to be the deletable
                admins[adminsLength - 1] = account;
            } else {
                // we shift elements in the array to the left
                admins[i] = admins[i + 1];
                // update indexes
                adminIndexes[admins[i]] = adminIndexes[admins[i]] - 1;
            }
            unchecked {
                ++i;
            }
        }

        admins.pop();
        // set index on array to 0
        delete adminIndexes[account];
        // update new array length
        _updateAdminsLength(admins.length);
    }

    /// @notice it returns an index of an address in the admins array, if admin. If not, it reverts.
    /// @param addr address of which index is to be retrieved.
    function adminIndex(address addr) public view returns (uint256) {
        // reverts if addr is not an admin
        _checkRole(ADMIN_ROLE, addr);
        return adminIndexes[addr];
    }

    /// @notice keeps track of how many accounts have become admins. Each time a new admin is added/removed, this number should increase/decrease automatically.
    /// @param _newAdminsLength new admins array length to be updated.
    function _updateAdminsLength(uint256 _newAdminsLength) internal {
        adminsLength = _newAdminsLength;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////CHECK FUNCTIONS///////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /// @notice it checks if a number is 0, and reverts if so.
    /// @param _amount value to be checked.
    function checkIsNonZero(uint256 _amount) internal pure {
        if (_amount == 0) revert Errors.ZeroAmount();
    }

    /// @notice it checks whether the contract's paused.
    function checkIfPaused() internal view {
        if (paused && !hasRole(ADMIN_ROLE, _msgSender()))
            revert Errors.Paused();
    }

    /// @notice it checks whether specific `ids` are within or out of the vesting period.
    /// @param user user against the lockup is to be checked for.
    /// @param ids tokens to be checked.
    function checkVestingSchedule(
        address user,
        uint[] memory ids
    ) internal view override {
        ///@dev skip check for `admins` or if the token is being transferred from another `from` by an admin.
        if (hasRole(ADMIN_ROLE, _msgSender())) {
            return;
        } else {
            super.checkVestingSchedule(user, ids);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////TOKEN FUNCTIONS///////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /// @notice it mints tokens or add to total supply of existing tokenID.
    /// @param id the tokenID for the supply to be added for.
    /// @param amount the amount by which the total supply should increase.
    /// @param to who will receive the minted tokens.
    /// @param releaseTime the time the token will be available to be transferred.
    function mint(
        uint256 id,
        uint256 amount,
        address to,
        uint256 releaseTime
    )
        public
        override
        onlyRole(ADMIN_ROLE)
        checkMultisigApproval(msg.sig, abi.encode(id, amount, to, releaseTime))
        nonReentrant
    {
        // validate
        checkIsNonZero(amount);

        // check if exists
        bool found = exists(id);

        // avoid repeteable IDs on mintedIDs array
        if (!found) mintedIDs.push(id);

        // make admins approved for token
        makeAllAdminsApproved(to);

        // add to supply
        super.mintToken(id, amount, to, releaseTime);
        emit MintToken(to, id, amount);
    }

    /// @notice it mints tokens in batch style. It adds to total supply of existing tokenIDs.
    /// @param ids the tokenID for the supply to be added for.
    /// @param amounts the amount by which the total supply should increase.
    /// @param to the address to receive the tokens.
    /// @param releaseTimes time for tokens to be made available.
    function mintBatch(
        uint256[] memory ids,
        uint256[] memory amounts,
        address to,
        uint256[] calldata releaseTimes
    )
        public
        override
        onlyRole(ADMIN_ROLE)
        checkMultisigApproval(
            msg.sig,
            abi.encode(ids, amounts, to, releaseTimes)
        )
        nonReentrant
    {
        uint tokensLength = ids.length == amounts.length &&
            amounts.length == releaseTimes.length
            ? ids.length
            : 0;

        /// @dev if below reverts, then arrays are empty or their length mismatches
        if (tokensLength == 0) revert Errors.ArrayLengthMismatch();
        for (uint64 i = 0; i < tokensLength; ) {
            //validate
            checkIsNonZero(amounts[i]);
            //check if exists
            bool exist = exists(ids[i]);
            //avoid repeteable IDs on mintedIDs array
            if (!exist) mintedIDs.push(ids[i]);
            unchecked {
                ++i;
            }
        }

        // make admins approved
        makeAllAdminsApproved(to);

        // add to supply
        super.mintBatch(ids, amounts, to, releaseTimes);
        // _mintBatch(to, ids, amounts, "0x");
        emit MintBatch(to, ids, amounts);
    }

    /// @notice it burns an amount of a single token from a user. It does not make checks for vesting, since this function will only be called by an admin - and it is assumed an admin will know when to burn a token.
    /// @param account account from which the tokens will be burned.
    /// @param _id id of the token to be burned.
    /// @param _amount amount of the token of ID _id to be burned.
    function burn(
        address account,
        uint256 _id,
        uint256 _amount
    )
        public
        nonReentrant
        onlyRole(ADMIN_ROLE)
        checkMultisigApproval(msg.sig, abi.encode(_id, _amount))
    {
        //validate
        checkIsNonZero(_amount);

        super.burn(account, _id, _amount);

        emit BurnToken(account, _id, _amount);
    }

    /// @notice it burns some amounts of tokens in batches from some user. It does not make checks for vesting, since this function will only be called by an admin - and it is assumed an admin will know when to burn a token.
    /// @param _from the address from which the tokens are to be burned.
    /// @param _ids the ids of the tokens which are to be burned.
    /// @param _amounts the amount of tokens of each id that are to be burned.
    function burnBatch(
        address _from,
        uint256[] memory _ids,
        uint256[] memory _amounts
    )
        public
        override
        nonReentrant
        onlyRole(ADMIN_ROLE)
        checkMultisigApproval(msg.sig, abi.encode(_from, _ids, _amounts))
    {
        super.burnBatch(_from, _ids, _amounts);
        emit BurnBatch(_from, _ids, _amounts);
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////ADMIN ONLY FUNCTIONS//////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /// @notice it sets a new URI string that represents the link to which tokens will be pointed to.
    /// @param _newuri the new URI link for the contract's tokens.
    function setURI(string memory _newuri) public onlyRole(ADMIN_ROLE) {
        baseURI = _newuri;
        _setURI(_newuri);
    }

    /// @notice it enables the contract to operate in the multisig scenario.
    function enableMultisig() external onlyRole(ADMIN_ROLE) {
        isMultisigEnabled = true;
    }

    /// @notice it disables the contract from operating in the multisig scenario.
    function disableMultisig() external onlyRole(ADMIN_ROLE) {
        isMultisigEnabled = false;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        paused = true;
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        paused = false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////VIEW FUNCTIONS//////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /// @notice it returns the summed supply of all the tokens that have been minted so far.
    function getTotalSupply() public view returns (uint256 total) {
        uint256 mintedLength = mintedIDs.length;
        for (uint32 i = 0; i < mintedLength; ) {
            total += totalSupply(mintedIDs[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * Return the token URI concatened with the id
     */
    function uri(
        uint256 _tokenId
    ) public view override returns (string memory) {
        if (!exists(_tokenId)) revert Errors.InvalidTokenID(_tokenId);
        return
            string(
                abi.encodePacked(baseURI, Strings.toString(_tokenId), ".json")
            );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice it transfers an amount of a single token from an account to another. As it uses the inherited function through `super`, it checks whether the token is vested, make all admins approved and then transfers.
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
    ) public override {
        checkIfPaused();

        uint[] memory ids = new uint[](1);
        ids[0] = id;

        checkVestingSchedule(from, ids);

        makeAllAdminsApproved(to);

        super.safeTransferFrom(from, to, id, amount, data);
    }

    /// @notice this is safe in the sense that it makes a call to the `to` param if it's a contract so that tokens won't get stuck.
    /// @param from admin from whom the tokens will be transferred to.
    /// @param users array of people who will receive the token.
    /// @param ids ids to be transferred to people.
    /// @param amounts amounts of each token to be transferred.
    function adminTransfer(
        address from,
        address[] calldata users,
        uint256[] calldata ids,
        uint256[] calldata releaseTimes,
        uint256[] calldata amounts
    ) public onlyRole(ADMIN_ROLE) {
        // checks
        uint length = (users.length == ids.length) &&
            (ids.length == amounts.length) &&
            (amounts.length == releaseTimes.length)
            ? users.length
            : 0;

        if (length == 0) revert Errors.ArrayLengthMismatch();

        // effects
        /// TODO: find an optimal number for which this function won't work due to block gas limit.
        for (uint i; i < length; ) {
            makeAllAdminsApproved(users[i]);
            unchecked {
                ++i;
            }
        }

        setReleaseTimes(users, ids, releaseTimes);

        /// @dev since it can only be called by an `admin`, we skip vesting checks and transfer the tokens directly.
        for (uint i; i < length; ) {
            super.safeTransferFrom(from, users[i], ids[i], amounts[i], "");
            unchecked {
                ++i;
            }
        }
    }

    /// @notice it transfer multiple amounts of different tokens from an account to another. As it uses the inherited function through `super`, it checks whether the token is vested, make all admins approved and then transfers.
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
        checkIfPaused();
        checkVestingSchedule(from, ids);

        makeAllAdminsApproved(to);

        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    /// @notice it sets the releaseTime for the specified tokens to 0, i.e., they can be already trasnferred/burned/etc.
    /// @param ids tokens for the release time to be ended for.
    function endReleaseTime(
        address[] calldata users,
        uint256[] calldata ids
    ) public override onlyRole(ADMIN_ROLE) {
        super.endReleaseTime(users, ids);
    }

    /// @notice it changes the release time for specific token `ids`. The release time can be anytime, including times in the past.
    /// @param ids the tokens for times to be changed for.
    /// @param releaseTimes the new times to be applied for these tokens.
    function modifyReleaseTime(
        address[] calldata users,
        uint256[] calldata ids,
        uint256[] calldata releaseTimes
    )
        public
        override
        onlyRole(ADMIN_ROLE)
        checkMultisigApproval(msg.sig, abi.encode(ids, releaseTimes))
    {
        super.modifyReleaseTime(users, ids, releaseTimes);
    }
}
