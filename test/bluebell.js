const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = require("mocha");

describe("Bluebell Token with Multisig DISABLED", function () {
    let ERC1155Model, bluebellTokenContract; //contract  
    let deployer, secondAdmin, thirdAdmin, possibleAdmin; //admins
    let firstUser, secondUser; //users
    let ADMIN_ROLE, DEFAULT_ADMIN_ROLE; //roles

    beforeEach(async () => {
        //accounts
        [deployer, secondAdmin, thirdAdmin, firstUser, secondUser, possibleAdmin] = await ethers.getSigners();

        //contracts
        ERC1155Model = await ethers.getContractFactory("BluebellToken");
        bluebellTokenContract = await ERC1155Model.deploy([deployer.address, secondAdmin.address, thirdAdmin.address], "baseURI/", 3, { gasLimit: 30000000 });

        // Get the ADMIN_ROLE from the contract
        ADMIN_ROLE = await bluebellTokenContract.ADMIN_ROLE();
        DEFAULT_ADMIN_ROLE = await bluebellTokenContract.DEFAULT_ADMIN_ROLE();
    });

    describe("Check Deployment Correctness", () => {
        it("Check DEFAULT_ADMIN_ROLE is right", async function () {
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
        });

        it("Check admins are right", async function () {
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, deployer.address)).to.equal(true);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.equal(true);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, thirdAdmin.address)).to.equal(true);
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
        });

        it("Token should exist after being minted", async function () {
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, thirdAdmin.address, ((await ethers.provider.getBlock()).timestamp));
            expect(await bluebellTokenContract.exists(1)).to.eq(true);
        });

        it("URI should have been set correctly", async function () {
            // tokenID 1 does not exist yet.
            await expect(bluebellTokenContract.uri(1)).to.be.reverted;

            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, thirdAdmin.address, ((await ethers.provider.getBlock()).timestamp));

            expect(await bluebellTokenContract.exists(1)).to.eq(true);

            expect(await bluebellTokenContract.uri(1)).to.equal("baseURI/1.json")
        });

        it("adminsLength should have been set correctly", async function () {
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
        });
    });

    describe("Role Management", () => {

        it("Any ADMIN_ROLE should pause/unpause the contract", async function () {
            //deployer
            await bluebellTokenContract.connect(deployer)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);

            //secondAdmin
            await bluebellTokenContract.connect(secondAdmin)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);

            //thirdAdmin
            await bluebellTokenContract.connect(thirdAdmin)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);
        });

        it("non-ADMIN_ROLE should revert for pause/unpause the contract", async function () {
            await bluebellTokenContract.connect(firstUser);
            expect(await bluebellTokenContract.pause()).to.be.reverted;
            expect(await bluebellTokenContract.unpause()).to.be.reverted;
        });

        it("DEFAULT_ADMIN_ROLE should grant/revoke ADMIN_ROLE to any address", async function () {
            //check deployer is default admin
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);

            //default admin should grante ADMIN_ROLE
            await bluebellTokenContract.connect(deployer);
            await bluebellTokenContract.grantRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.equal(true);
            //default admin should revoke role
            await bluebellTokenContract.connect(deployer).revokeRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.equal(false);

            //default admin should revoke role of a admin added on contract construction
            await bluebellTokenContract.revokeRole(ADMIN_ROLE, secondAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.equal(false);

            //default admin should grant again role for a admin added on contract construction
            await bluebellTokenContract.grantRole(ADMIN_ROLE, secondAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.equal(true);
        });

        it("ADMIN_ROLE should not grant/revoke ADMIN_ROLE to another address", async function () {
            await expect(bluebellTokenContract.connect(thirdAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            await expect(bluebellTokenContract.connect(thirdAdmin).revokeRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
        });

        it("ADMIN_ROLE should not grant/revoke DEFAULT_ADMIN_ROLE to/from any address", async function () {
            // trying to grant DEFAULT_ADMIN_ROLE  
            await expect(bluebellTokenContract.connect(secondAdmin).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            // trying to revoke DEFAULT_ADMIN_ROLE
            await expect(bluebellTokenContract.connect(secondAdmin).revokeRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.reverted;
        });

        it("DEFAULT_ADMIN_ROLE should grant/revoke DEFAULT_ADMIN_ROLE to/from any address", async function () {
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true);
            await bluebellTokenContract.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.eq(true);

            await bluebellTokenContract.connect(deployer).revokeRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.eq(false);
        });

        it("ADMIN_ROLE should not add/remove an admin", async () => {
            // check is non-admin
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(false);

            // ADMIN_ROLE adds a new admin
            await expect(bluebellTokenContract.connect(thirdAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;

        });

        it("new DEFAULT_ADMIN_ROLE should be able to make itself an admin", async function () {

            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.eq(true);
            await bluebellTokenContract.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.be.eq(true);

            await bluebellTokenContract.connect(possibleAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(true);
        });

        it("ADMIN_ROLE should change multisig state with enableMultisig/disableMultisig", async () => {
            //check secondAdmin is ADMIN_ROLE
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.eq(true);

            //changing multisig state
            await bluebellTokenContract.connect(secondAdmin).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.equal(true);
            await bluebellTokenContract.connect(secondAdmin).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.equal(false);

            await expect(bluebellTokenContract.connect(possibleAdmin).enableMultisig()).to.be.reverted;
        });

        it("check removal of admin correctly works", async function () {
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
            expect(await bluebellTokenContract.connect(deployer).revokeRole(ADMIN_ROLE, thirdAdmin.address));
            // chec.to.be.reverted thirdSignet has been removed.
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, thirdAdmin.address)).to.eq(false);
            // check 0 address isn't a admin.
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, ethers.constants.AddressZero)).to.eq(false);
            // check the other admins remain unchanged
            expect(await bluebellTokenContract.admins(0)).to.equal(deployer.address);
            expect(await bluebellTokenContract.admins(1)).to.equal(secondAdmin.address);
            // check adminsLength has decreased correctly
            expect(await bluebellTokenContract.adminsLength()).to.eq(2);
        });

        it("check indexes from admins correctly work after removal of some admin", async function () {
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
            expect(await bluebellTokenContract.adminIndex(deployer.address)).to.eq(0);
            expect(await bluebellTokenContract.adminIndex(secondAdmin.address)).to.eq(1);
            expect(await bluebellTokenContract.adminIndex(thirdAdmin.address)).to.eq(2);
            await expect(bluebellTokenContract.adminIndex(ethers.constants.AddressZero)).to.be.reverted;

            expect(await bluebellTokenContract.connect(deployer).revokeRole(ADMIN_ROLE, secondAdmin.address));
            // chec.to.be.revertedk secondAdmin has been removed.
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.eq(false);
            // check 0 address isn't a admin.
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, ethers.constants.AddressZero)).to.eq(false);
            // check adminsLength has decreased correctly
            expect(await bluebellTokenContract.adminsLength()).to.eq(2);

            // check the other admins remain unchanged
            expect(await bluebellTokenContract.adminIndex(deployer.address)).to.eq(0);
            expect(await bluebellTokenContract.adminIndex(thirdAdmin.address)).to.eq(1);

            await expect(bluebellTokenContract.adminIndex(secondAdmin.address)).to.be.reverted;
        });

        it("all admins are also ADMIN_ROLEs", async function () {
            // add a new admin just for testing if the role is granted on addition to the admins array:
            await bluebellTokenContract.connect(deployer).grantRole(ADMIN_ROLE, possibleAdmin.address);
            // expect addition ocurred
            const allAdmins = await bluebellTokenContract.adminsLength();
            expect(allAdmins).to.eq(4);

            for (let i = 0; i < allAdmins; i++) {
                const admin = await bluebellTokenContract.admins(i);
                expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, admin)).to.eq(true);
            }
        });
    });

    describe("Interactions on DISABLED Multisig", () => {

        it("Any ADMIN_ROLE && DEFAULT_ADMIN_ROLE should enable/disable Multisig Funcionality", async function () {
            //check it's disabled by default
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(false);

            //ADMIN_ROLE should enable/disable it
            await bluebellTokenContract.connect(thirdAdmin).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            await bluebellTokenContract.connect(thirdAdmin).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(false);
            //DEFAULT_ADMIN_ROLE should enable/disable it
            await bluebellTokenContract.connect(deployer).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            await bluebellTokenContract.connect(deployer).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(false);
        });

        it("mintToken should mint correctly for ADMIN_ROLE", async () => {
            //ADMIN_ROLE/DEFAULT_ADMIN_ROLE trying mint to himself alone
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            //deployer = firstAdmin minting to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("mintBatch in batch should mint correctly ADMIN_ROLE", async () => {

            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //thirdAdmin minting to secondAdmin
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(221);
        });

        it("ADMIN_ROLE burnToken should burnToken own tokens correctly", async () => {
            //ADMIN_ROLE/DEFAULT_ADMIN_ROLE trying burnToken tokens from himself
            //to burnToken, deployer = firstAdmin should first have token.
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            //deployer = firstAdmin burning from himself
            await bluebellTokenContract.connect(deployer).burnToken(deployer.address, 1, 1);
            //burned
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
        });

        it("ADMIN_ROLE burnBatch tokens should burnToken tokens from users even if not approved", async () => {
            //thirdAdmin minting to secondAdmin
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            //check balances are non-zero
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(221);

            //thirdAdmin burns from other admin address.
            //TODO: make approval in contract as for COPF - in transfers also, so that admins will always have approvals.
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(secondAdmin.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(0);
        });

        it("ADMIN_ROLE burnBatch tokens should burnToken tokens from other admins", async () => {
            //thirdAdmin minting to secondAdmin
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            //check balances are non-zero
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1000)).to.eq(221);

            //thirdAdmin burns from other admin address.
            //TODO: make approval in contract as for COPF - in transfers also, so that admins will always have approvals.
            await bluebellTokenContract.connect(secondAdmin).burnBatch(deployer.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1000)).to.eq(0);
        });

        it("ADMIN_ROLE burnBatch tokens should burn tokens from users", async () => {

            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            //thirdAdmin minting to secondAdmin
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            await bluebellTokenContract.connect(deployer).grantRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(true);
            await bluebellTokenContract.connect(secondAdmin).setApprovalForAll(possibleAdmin.address, true);
            await bluebellTokenContract.connect(possibleAdmin).burnBatch(secondAdmin.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(0);
        });
    });

    describe("Token Functionality on DISABLED Multisig", function () {

        it("mintToken() for a new token ID", async () => {
            // only ADMIN_ROLE may mint
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 10, firstUser.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(10);
        });

        it("not ADMIN_ROLE should not be able to mintToken()", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await expect(bluebellTokenContract.connect(secondUser).mintToken(1, 10, secondUser.address, releaseTime)).to.be.reverted;
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
        });

        it("pre-approved user should burnToken() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintToken(1000, 1, firstUser.address, releaseTime);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            // user approves another user to burnToken his tokens
            await bluebellTokenContract.connect(firstUser).setApprovalForAll(secondUser.address, true);
            // check another user is approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(true);
            // second user burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnToken(firstUser.address, 1000, 1)).to.be.reverted;
        });

        it("non-pre-approved user should not burnToken() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintToken(1000, 1, firstUser.address, releaseTime);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            // check another user is not approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(false);
            // second user burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnToken(firstUser.address, 1000, 1)).to.be.reverted;
            // check token wasn't burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
        });

        it("pre-approved user should not burnBatch() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
            // user approves another user to burnToken his tokens
            await bluebellTokenContract.connect(firstUser).setApprovalForAll(secondUser.address, true);
            // check another user is approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(true);
            // second user burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnBatch(firstUser.address, [1000, 1001, 1002], [1, 2, 3])).to.be.reverted;
            // check token was not burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
        });

        it("non-pre-approved user should not burnBatch() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
            // check another user is not approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(false);
            // second user burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnBatch(firstUser.address, [1000, 1001, 1002], [1, 2, 3])).to.be.reverted;
            // check token was indeed burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
        });

        it("ensure correct events (MintToken, MintBatch, BurnToken, BurnBatch) are emitted", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // Listening for the events
            await expect(bluebellTokenContract.connect(secondAdmin).mintToken(4, 5, firstUser.address, releaseTime)).to.emit(bluebellTokenContract, 'MintToken');
            await expect(bluebellTokenContract.connect(secondAdmin).mintBatch([4], [5], firstUser.address, [releaseTime])).to.emit(bluebellTokenContract, 'MintBatch');
            await expect(bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 4, 3)).to.emit(bluebellTokenContract, 'BurnToken');
            await expect(bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [4], [3])).to.emit(bluebellTokenContract, 'BurnBatch');
        });

        it("check the mintedIDs has been updated after minting new tokens", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 100000, firstUser.address, releaseTime);
            expect(ethers.BigNumber.from(await bluebellTokenContract.mintedIDs(0))).to.equal(ethers.BigNumber.from(1));
        });

        it("verify the total supply with getTotalSupply() is correct", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check user balance has updated:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);
            // total supply should equal 1+2+3+4+5=15 
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(15);
        });

        it("check transfer in between users works", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // check balance before of user who'll receive the tokens:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
            // transfers happen
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 1, 1, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 3, 3, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 4, 4, "0x");
            // he may not trasnfer all his balance of some particular token id
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 1000, 4, "0x");

            // check the new owner has approved the admins
            for (let i = 0; i < await bluebellTokenContract.adminsLength(); i++) {
                expect(await bluebellTokenContract.isApprovedForAll(secondUser.address, await bluebellTokenContract.admins(i))).to.eq(true);
            }

            // check someone else balance after:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(4);

            // check who transferred the tokens has had its balance diminished
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
        });

        it("check batchTransfer in between users works", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // check balance before of user who'll receive the tokens:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
            // transfers happen
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 3, 4, 1000], [1, 1, 1, 1, 2], "0x");

            // check the new owner has approved the admins
            for (let i = 0; i < await bluebellTokenContract.adminsLength(); i++) {
                expect(await bluebellTokenContract.isApprovedForAll(secondUser.address, await bluebellTokenContract.admins(i))).to.eq(true);
            }

            // check someone else balance after:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(2);

            // check who transferred the tokens has had its balance diminished
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(3);
        });

        it("check contract is secure against user toying with inputs on batchTransfer", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // check balance before of user who'll receive the tokens:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);

            // user tries to pass different lengths in the different arrays.
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 3, 4, 1000], [1, 1, 1, 1], "0x")).to.be.revertedWithCustomError(bluebellTokenContract, 'ERC1155InvalidArrayLength');

            // user tries to pass empty arrays.
            bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [], [], "0x");
            // check the above had no effect
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
        });
    });

    describe("Vesting", function () {
        it("transfer from admins should work regardless of release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
        });

        it("transfer from owners or approved for tokens should not work if release time is not over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await expect(bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, ethers.constants.HashZero)).to.be.reverted;
        });

        it("transfer from owners or approved for tokens should work once  release time is over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
        });

        it("transferBatch from admins should work regardless of release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("transferBatch from owners or approved for tokens should not work if release time is not over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);


            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2], [1, 2], ethers.constants.HashZero)).to.be.reverted;
        });

        it("transferBatch from owners or approved for tokens should work once release time is over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2], [1, 2], ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
        });

        it("modifyReleaseTime should modify releaseTime if called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            await bluebellTokenContract.modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);

            // after modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            //unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.lt((await ethers.provider.getBlock()).timestamp);
        });

        it("modifyReleaseTime should not modify releaseTime if not called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            await expect(bluebellTokenContract.connect(firstUser).modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime])).to.be.reverted;

            // no modification was made
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);
        });

        it("modifyReleaseTime should allow for transfers if new releaseTime is set to a past timestmap", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp - 100;
            await bluebellTokenContract.modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);

            // after modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            //unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);

            // transfer modified, but do not transfer unmodified
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(5);

            // revert when trying to transfer unmodified
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [3, 4], [3, 4], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });

        it("endReleaseTime should make token available if called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');

            // reset endReleaseTime
            await bluebellTokenContract.endReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000]);

            // after endReleaseTime
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero);

            // unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);

            // check theyve been transferred.
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(5);

            // revert when trying to transfer unmodified
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [3, 4], [3, 4], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });

        it("endReleaseTime should not make token available if not called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');

            // reset endReleaseTime
            await expect(bluebellTokenContract.connect(secondUser).endReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000])).to.be.reverted;

            // after endReleaseTime by an unauthorized user 
            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });
    });

    describe("Token Transfers", function () {
        it("transfer on paused should not work for non-admins", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'Paused');
        });

        it("transfer on paused should work for admins", async function () {
            await bluebellTokenContract.connect(deployer).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1);

            await bluebellTokenContract.connect(secondAdmin).safeBatchTransferFrom(secondAdmin.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("transfer on paused should not work for non-admins even if release time is over", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'Paused');
        });

        it("transfer on unpaused should work if release time is over", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await bluebellTokenContract.connect(secondAdmin).unpause();

            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("transfer for admins should work regardless releaseTime and contract being paused simultaneously ", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            // release time is not over.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // contract is paused && release time has not been reached, yet admin can transfer tokens.
            await bluebellTokenContract.connect(thirdAdmin).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);
        });

        it("transferBatch for admins should work regardless releaseTime and contract being paused simultaneously", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            // release time is not over.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // contract is paused && release time has not been reached, yet admin can transfer tokens.
            await bluebellTokenContract.connect(thirdAdmin).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("batch transfer to many people at once should work for admins from any user", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).adminTransfer(firstUser.address, [deployer.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [releaseTime, releaseTime, releaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
        });
    });

    describe("Traditional Journey", function () {
        it("admins should mint for themselves regardless release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 1000;

            // admin mints for himself.
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.gt(0);

            // check admin has release time set, i.e., it's not 0.
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // yet they can transfer.
            await bluebellTokenContract.connect(deployer).safeTransferFrom(deployer.address, firstUser.address, 1, 1, ethers.constants.HashZero);

            // check new owner has a zeroed vesting schedule.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.eq(0);
        });

        it("admins should mint to anyone regardless release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 1000;

            // admin mints for himself.
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.gt(0);

            // check admin has release time set, i.e., it's not 0.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // yet they can transfer.
            await bluebellTokenContract.connect(deployer).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);
            await bluebellTokenContract.connect(deployer).safeTransferFrom(deployer.address, secondUser.address, 1, 1, ethers.constants.HashZero);

            //NOTE: if this situation happens the user won't have their vestingSchedule zeroed-out. That's why the owners should call the `modify` or `end` releaseTime functions.
        });

        it("admins should batch transfer to anyone and the receiver should have their vesting schedule updated", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // empty tokens 1, 2 and 3 from firstUser
            await bluebellTokenContract.connect(deployer).adminTransfer(firstUser.address, [deployer.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [releaseTime, releaseTime, releaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);

            // yet, admin can transfer though his vesting schedule has been updated.
            await bluebellTokenContract.connect(deployer).safeTransferFrom(deployer.address, secondAdmin.address, 1, 1, ethers.constants.HashZero);
        });

        it("admins should batch transfer from admins and receivers should have their vesting schedules updated", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            const updatedReleaseTime = (await ethers.provider.getBlock()).timestamp + 500;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(5);

            // empty tokens 1, 2 and 3 from firstUser
            await bluebellTokenContract.connect(deployer).adminTransfer(secondAdmin.address, [firstUser.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [updatedReleaseTime, updatedReleaseTime, updatedReleaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp for the users who've received the tokens.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);

            // vesting schedule should now be the specified time in the updated release time, not on the `mintBatch`
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.eq(updatedReleaseTime);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.eq(updatedReleaseTime);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.eq(updatedReleaseTime);
        });
    });

    describe("Burning of Tokens", function () {
        it("admins may burn tokens from themselves and users", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("users cannot burn their own tokens", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // burnBatch
            await expect(bluebellTokenContract.connect(firstUser).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4])).to.be.reverted;

            // burnToken
            await expect(bluebellTokenContract.connect(firstUser).burnToken(firstUser.address, 1000, 5)).to.be.reverted;
        });

        it("admins may burn before vesting scheduled time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // expect the release time to be far in the future
            expect(releaseTime).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // expect the release time to be far in the future
            expect(releaseTime).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("admins may burn after vesting schedules time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // expect the release time to be far in the past
            expect(releaseTime).to.be.lt((await ethers.provider.getBlock()).timestamp);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // expect the release time to be far in the past
            expect(releaseTime).to.be.lt((await ethers.provider.getBlock()).timestamp);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("burn correctly diminishes the totalSupply for the burned token", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // before burn
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(15);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // after first burn 
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(5);

            // function overloading issue, that's why we call it this way on hardhat/ethers.
            // https://github.com/ethers-io/ethers.js/issues/407
            expect(await bluebellTokenContract["totalSupply(uint256)"](1000)).to.eq(5);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);

            // after second burn
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(0);
            expect(await bluebellTokenContract["totalSupply(uint256)"](1000)).to.eq(0);
        });
    });
});

describe("Bluebell Token with Multisig ENABLED", function () {
    let ERC1155Model, bluebellTokenContract; //contract  
    let deployer, secondAdmin, thirdAdmin, possibleAdmin; //admins
    let firstUser, secondUser; //users
    let ADMIN_ROLE, DEFAULT_ADMIN_ROLE; //roles

    beforeEach(async () => {
        //accounts
        [deployer, secondAdmin, thirdAdmin, firstUser, secondUser, possibleAdmin] = await ethers.getSigners();

        //contracts
        ERC1155Model = await ethers.getContractFactory("BluebellToken");
        bluebellTokenContract = await ERC1155Model.deploy([deployer.address, secondAdmin.address, thirdAdmin.address], "baseURI/", 3);

        // Get the ADMIN_ROLE from the contract
        ADMIN_ROLE = await bluebellTokenContract.ADMIN_ROLE();
        DEFAULT_ADMIN_ROLE = await bluebellTokenContract.DEFAULT_ADMIN_ROLE();

        // make sure multsig is enabled
        await bluebellTokenContract.connect(secondAdmin).enableMultisig();
        expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
    });

    describe("Check Deployment Correctness", () => {

        it("Check DEFAULT_ADMIN_ROLE is right", async function () {
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
        });

        it("Check admins are right", async function () {
            let index = await bluebellTokenContract.adminIndex(deployer.address);
            expect(await bluebellTokenContract.admins(index)).to.equal(deployer.address);
            index = await bluebellTokenContract.adminIndex(secondAdmin.address);
            expect(await bluebellTokenContract.admins(index)).to.equal(secondAdmin.address);
            index = await bluebellTokenContract.adminIndex(thirdAdmin.address);
            expect(await bluebellTokenContract.admins(index)).to.equal(thirdAdmin.address);
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
        });

        it("Token should exist after being minted", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, thirdAdmin.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, thirdAdmin.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, thirdAdmin.address, releaseTime);
            expect(await bluebellTokenContract.exists(1)).to.eq(true);
        });

        it("URI should have been set correctly", async function () {
            // before minting
            await expect(bluebellTokenContract.uri(1)).to.be.reverted;

            // make sure everyone is an ADMIN_ROLE
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, deployer.address)).to.eq(true);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.eq(true);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, thirdAdmin.address)).to.eq(true);

            // minting with multisig
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);

            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);

            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, deployer.address, releaseTime);

            expect(await bluebellTokenContract.exists(1)).to.eq(true);

            expect(await bluebellTokenContract.uri(1)).to.equal("baseURI/1.json");
        });

        it("adminsLength should have been set correctly", async function () {
            expect(await bluebellTokenContract.adminsLength()).to.eq(3);
        });

        it("check minimumApprovalsNumber is 3 by default", async function () {
            expect(await bluebellTokenContract.minimumApprovalsNumber()).to.eq(3);
        });
    });

    describe("Role Management", () => {

        it("Any ADMIN_ROLE should pause/unpause the contract", async function () {
            //deployer
            await bluebellTokenContract.connect(deployer)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);

            //secondAdmin
            await bluebellTokenContract.connect(secondAdmin)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);

            //thirdAdmin
            await bluebellTokenContract.connect(thirdAdmin)
            await bluebellTokenContract.pause();
            expect(await bluebellTokenContract.paused()).to.equal(true);
            await bluebellTokenContract.unpause();
            expect(await bluebellTokenContract.paused()).to.equal(false);
        });

        it("non-ADMIN_ROLE should revert for pause/unpause the contract", async function () {
            await bluebellTokenContract.connect(firstUser);
            expect(await bluebellTokenContract.pause()).to.be.reverted;
            expect(await bluebellTokenContract.unpause()).to.be.reverted;
        });

        it("DEFAULT_ADMIN_ROLE should grant/revoke ADMIN_ROLE to any address", async function () {
            //check deployer is default admin
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);

            //default admin should grante ADMIN_ROLE
            await bluebellTokenContract.connect(deployer.address);
            await bluebellTokenContract.grantRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.equal(true);

            //default admin should revoke role
            await bluebellTokenContract.revokeRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.equal(false);

            //default admin should revoke role of a admin added on contract construction
            await bluebellTokenContract.revokeRole(ADMIN_ROLE, secondAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.equal(false);

            //default admin should grant again role for a admin added on contract construction
            await bluebellTokenContract.grantRole(ADMIN_ROLE, secondAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.equal(true);
        });

        it("ADMIN_ROLE should not grant/revoke ADMIN_ROLE to another address", async function () {
            await expect(bluebellTokenContract.connect(thirdAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            await expect(bluebellTokenContract.connect(thirdAdmin).revokeRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
        });

        it("ADMIN_ROLE should not grant/revoke DEFAULT_ADMIN_ROLE to/from any address", async function () {
            // trying to grant DEFAULT_ADMIN_ROLE  
            await expect(bluebellTokenContract.connect(secondAdmin).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            // trying to revoke DEFAULT_ADMIN_ROLE
            await expect(bluebellTokenContract.connect(secondAdmin).revokeRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.reverted;
        });

        it("DEFAULT_ADMIN_ROLE should grant/revoke DEFAULT_ADMIN_ROLE to/from any address", async function () {
            await bluebellTokenContract.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.eq(true);

            await bluebellTokenContract.connect(deployer).revokeRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.eq(false);
        });

        it("ADMIN_ROLE should not add/remove a new admin", async () => {
            // check is non-admin
            const adminsLengthBefore = await bluebellTokenContract.adminsLength();
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(false);
            // ADMIN_ROLE adds a new admin
            await expect(bluebellTokenContract.connect(thirdAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(false);

            // ADMIN_ROLE removes admin
            await expect(bluebellTokenContract.connect(thirdAdmin).revokeRole(ADMIN_ROLE, possibleAdmin.address)).to.be.reverted;
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(false);
            const adminsLengthAfter = await bluebellTokenContract.adminsLength();
            expect(adminsLengthAfter).to.eq(adminsLengthBefore);
        });

        it("new DEFAULT_ADMIN_ROLE should be able to make itself a admin", async function () {
            await bluebellTokenContract.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(DEFAULT_ADMIN_ROLE, possibleAdmin.address)).to.be.eq(true);
            // new DEFAULT_ADMIN_ROLE should make itself an ADMIN_ROLE first
            await bluebellTokenContract.connect(possibleAdmin).grantRole(ADMIN_ROLE, possibleAdmin.address);
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, possibleAdmin.address)).to.eq(true);
        });

        it("ADMIN_ROLE should change multisig state with enableMultisig/disableMultisig", async () => {
            //check secondAdmin is ADMIN_ROLE
            expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, secondAdmin.address)).to.eq(true);

            //changing multisig state
            await bluebellTokenContract.connect(secondAdmin).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.equal(true);
            await bluebellTokenContract.connect(secondAdmin).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.equal(false);

            await expect(bluebellTokenContract.connect(possibleAdmin).enableMultisig()).to.be.reverted;
        });

        it("all admins are also ADMIN_ROLEs", async function () {
            // add a new admin just for testing if the role is granted on addition to the admins array:
            await bluebellTokenContract.connect(deployer).grantRole(ADMIN_ROLE, possibleAdmin.address);
            // expect addition ocurred
            const allAdmins = await bluebellTokenContract.adminsLength();
            expect(allAdmins).to.eq(4);

            for (let i = 0; i < allAdmins; i++) {
                const admin = await bluebellTokenContract.admins(i);
                expect(await bluebellTokenContract.hasRole(ADMIN_ROLE, admin)).to.eq(true);
            }
        });
    });

    describe("Interactions on ENABLED Multisig", () => {

        it("Any ADMIN_ROLE && DEFAULT_ADMIN_ROLE should enable/disable Multisig Funcionality", async function () {
            //check it's enabled because it was enabled after contract construction
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);

            //ADMIN_ROLE should enable/disable it
            await bluebellTokenContract.connect(thirdAdmin).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            await bluebellTokenContract.connect(thirdAdmin).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(false);
            //DEFAULT_ADMIN_ROLE should enable/disable it
            await bluebellTokenContract.connect(deployer).enableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            await bluebellTokenContract.connect(deployer).disableMultisig();
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(false);
        });

        it("mintToken should not mint for only 1 call", async () => {
            //check multisig is enabled:
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);

            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //deployer = firstAdmin = ADMIN_ROLE trying to mint to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);

            // check there will not update on deployer balance since there wasn't an approval from other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
        });

        it("mintToken should not mint for only 2 calls", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //check multisig is enabled:
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);

            //deployer = firstAdmin = ADMIN_ROLE trying to mint to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);

            // check there will not update on deployer balance since there wasn't an approval of minimumApprovalsNumber from other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
        });

        it("mintToken should not mint with minimum approvals call from the same admin", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //check multisig is enabled:
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            // minimumApprovalsNumber should still be 3 due to no change have been made to it.
            expect(await bluebellTokenContract.minimumApprovalsNumber()).to.eq(3);
            //deployer = firstAdmin = ADMIN_ROLE trying to mint to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            // check there will not update on deployer balance since there wasn't an approval from other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
        });

        it("mintToken should mint with minimum approvals call from different admins", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //check multisig is enabled:
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            // minimumApprovalsNumber should still be 3 due to no change have been made to it.
            expect(await bluebellTokenContract.minimumApprovalsNumber()).to.eq(3);
            //deployer = firstAdmin = ADMIN_ROLE trying to mint to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, deployer.address, releaseTime);
            // check there will be an update on deployer balance since there was an approval from other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("mintToken should mint with minimum approvals call from different admins", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //check multisig is enabled:
            expect(await bluebellTokenContract.isMultisigEnabled()).to.eq(true);
            // minimumApprovalsNumber should still be 3 due to no change have been made to it.
            expect(await bluebellTokenContract.minimumApprovalsNumber()).to.eq(3);
            //deployer = firstAdmin = ADMIN_ROLE trying to mint to himself
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, deployer.address, releaseTime);
            // check there will be an update on deployer balance since there was an approval from other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            // a fourth call doesn't make the thing to be done again
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("mintBatch in batch should not mint for 1 call", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //thirdAdmin minting to secondAdmin
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime]);

            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(0);
        });

        it("mintBatch in batch should not mint for 2 calls", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //thirdAdmin minting to secondAdmin
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(0);
        });

        it("mintBatch in batch should mint with minimum calls", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            // check how many calls need to be made:
            expect(await bluebellTokenContract.minimumApprovalsNumber()).to.eq(3);
            // all admins having made the same call. The order of the calls doesn't matter
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(221);
        });

        it("ADMIN_ROLE burnToken should not burnToken own tokens with 1 call", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //ADMIN_ROLE/DEFAULT_ADMIN_ROLE trying burnToken tokens from himself
            //to burnToken, deployer = firstAdmin should first have token.
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, deployer.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            //deployer = firstAdmin burning from himself
            await bluebellTokenContract.connect(deployer).burnToken(deployer.address, 1, 1);
            // it won't work because the tx wasn't made from the other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("ADMIN_ROLE burnToken should burnToken own tokens with minimum calls", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            //ADMIN_ROLE/DEFAULT_ADMIN_ROLE trying burnToken tokens from himself
            //to burnToken, deployer = firstAdmin should first have token.
            await bluebellTokenContract.connect(deployer).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 1, deployer.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 1, deployer.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);


            await bluebellTokenContract.connect(deployer).setApprovalForAll(secondAdmin.address, true);
            //deployer = firstAdmin burning from himself: order doesn't matter here because the way we've implemented setApprovalForAll function
            await bluebellTokenContract.connect(secondAdmin).burnToken(deployer.address, 1, 1);
            await bluebellTokenContract.connect(deployer).burnToken(deployer.address, 1, 1);
            await bluebellTokenContract.connect(thirdAdmin).burnToken(deployer.address, 1, 1);
            // it will work because there was the same call made from the other admins.
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
        });

        it("ADMIN_ROLE should burnBatch tokens from user even if not approved directly", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            //ADMIN_ROLE or DEFAULT_ADMIN_ROLE burning tokens from other users doesn't work if users holders of tokens haven't approved the ADMINs to do so. 

            //admins minting to secondAdmin in multisig
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            //check balances are non-zero
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(221);

            //since the admins haven't been approved by user, when the last one tries to burnToken, he won't be able to due to the lack of approval.
            await expect(bluebellTokenContract.connect(thirdAdmin).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]));
            await expect(bluebellTokenContract.connect(secondAdmin).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]));
            await bluebellTokenContract.connect(deployer).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
        });

        it("ADMIN_ROLE should burnBatch tokens from user if approved directly", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //admins mint tokens to user
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], secondUser.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            //possibleAdmin approves the secondAdmin to burnToken his tokens
            await bluebellTokenContract.connect(secondUser).setApprovalForAll(possibleAdmin.address, true);

            // it should revert since 'possibleAdmin' isn't ADMIN_ROLE and only ADMIN_ROLEs can burnToken.
            await expect(bluebellTokenContract.connect(possibleAdmin).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221])).to.be.reverted;

            //check nothing's been burned, since 'possibleAdmin' isn't ADMIN_ROLE
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(221);

            // since the user has approved the admins to burnToken his tokens implicitly, they can do so.

            // check admins are approved:
            const adminsLength = await bluebellTokenContract.adminsLength();
            for (let i = 0; i < adminsLength; i++) {
                expect(await bluebellTokenContract.isApprovedForAll(secondUser.address, await bluebellTokenContract.admins(i))).to.eq(true);
            }

            await bluebellTokenContract.connect(thirdAdmin).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);
            await bluebellTokenContract.connect(deployer).burnBatch(secondUser.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
        });

        it("ADMIN_ROLE burnBatch tokens should burnToken tokens from other admins", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            //thirdAdmin minting to secondAdmin
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 1000], [1000, 666, 444, 221], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime]);

            //check balances are non-zero
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1000);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 2)).to.eq(666);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 3)).to.eq(444);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1000)).to.eq(221);

            //thirdAdmin burns from other admin address.
            //TODO: make approval in contract as for COPF - in transfers also, so that admins will always have approvals.
            await bluebellTokenContract.connect(deployer).burnBatch(deployer.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(deployer.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(deployer.address, [1, 2, 3, 1000], [1000, 666, 444, 221]);

            //check's burned
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(deployer.address, 1000)).to.eq(0);
        });
    });

    describe("Token Functionality on ENABLED Multisig", function () {

        it("mintToken() for a new token ID", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            //only ADMIN_ROLE may mint
            // ID, AMOUNT, TO
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 10, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(1, 10, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 10, firstUser.address, releaseTime);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(10);
        });

        it("not ADMIN_ROLE should not be able to mintToken()", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            await expect(bluebellTokenContract.connect(secondUser).mintToken(1, 10, secondUser.address, releaseTime)).to.be.reverted;
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
        });

        it("pre-approved user should not burnToken() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintToken(1000, 1, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1000, 1, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1000, 1, firstUser.address, releaseTime);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            // user approves another user to burnToken his tokens
            await bluebellTokenContract.connect(firstUser).setApprovalForAll(secondUser.address, true);
            // check another user is approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(true);
            // second user should not burnToken his tokens since burnToken are only for ADMIN_ROLEs
            await expect(bluebellTokenContract.connect(secondUser).burnToken(firstUser.address, 1000, 1)).to.be.reverted;
            // check token wasn't burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
        });

        it("non-pre-approved user should not burnToken() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintToken(1000, 1, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(secondAdmin).mintToken(1000, 1, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1000, 1, firstUser.address, releaseTime);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            // check another user is not approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(false);
            // second user burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnToken(firstUser.address, 1000, 1)).to.be.reverted;
            // check token wasn't burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
        });

        it("pre-approved user should not burnBatch() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
            // user approves another user to burnToken his tokens
            await bluebellTokenContract.connect(firstUser).setApprovalForAll(secondUser.address, true);
            // check another user is approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(true);
            // second user should not burnToken his tokens.
            await expect(bluebellTokenContract.connect(secondUser).burnBatch(firstUser.address, [1000, 1001, 1002], [1, 2, 3])).to.be.reverted;
            // check token wasn't indeed burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
        });

        it("non-pre-approved user should not burnBatch() from another user", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;
            // make sure user has the tokens in the first place
            await bluebellTokenContract.connect(deployer).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1000, 1001, 1002], [1, 2, 3], firstUser.address, [releaseTime, releaseTime, releaseTime]);
            // check user has some balance
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
            // check another user is not approved to burnToken tokens from user that approved him to do so
            expect(await bluebellTokenContract.isApprovedForAll(firstUser.address, secondUser.address)).to.eq(false);
            // second user should not burnToken his tokens
            await expect(bluebellTokenContract.connect(secondUser).burnBatch(firstUser.address, [1000, 1001, 1002], [1, 2, 3])).to.be.reverted;
            // check token was not indeed burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1001)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1002)).to.eq(3);
        });

        it("ensure correct events (MintToken, MintBatch, BurnToken, BurnBatch) are emitted", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            // Listening for the events in multisig scenario will only be emitted once all the admins have approved the tx
            // mint tokens for user
            await bluebellTokenContract.connect(secondAdmin).mintToken(4, 5, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(4, 5, firstUser.address, releaseTime);
            // event emitted on third call
            await expect(bluebellTokenContract.connect(thirdAdmin).mintToken(4, 5, firstUser.address, releaseTime)).to.emit(bluebellTokenContract, 'MintToken');;

            // first user approves admins to burnToken its tokens
            await bluebellTokenContract.connect(firstUser).setApprovalForAll(secondAdmin.address, true);
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 4, 3);
            await bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 4, 3);
            await expect(bluebellTokenContract.connect(deployer).burnToken(firstUser.address, 4, 3)).to.emit(bluebellTokenContract, 'BurnToken');
            //----------------------------------------------------------------
            // mint tokens for user
            await bluebellTokenContract.connect(secondAdmin).mintBatch([4], [5], firstUser.address, [releaseTime]);
            await bluebellTokenContract.connect(deployer).mintBatch([4], [5], firstUser.address, [releaseTime]);
            // event emitted on third call
            await expect(bluebellTokenContract.connect(thirdAdmin).mintBatch([4], [5], firstUser.address, [releaseTime])).to.emit(bluebellTokenContract, 'MintBatch');;

            await bluebellTokenContract.connect(deployer).burnBatch(firstUser.address, [4], [3]);
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [4], [3]);
            await expect(bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [4], [3])).to.emit(bluebellTokenContract, 'BurnBatch');
        });

        it("check the mintedIDs has been updated after minting new tokens", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(secondAdmin).mintToken(1, 100000, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(deployer).mintToken(1, 100000, firstUser.address, releaseTime);
            await bluebellTokenContract.connect(thirdAdmin).mintToken(1, 100000, firstUser.address, releaseTime);
            expect(ethers.BigNumber.from(await bluebellTokenContract.mintedIDs(0))).to.equal(ethers.BigNumber.from(1));
        });

        it("verify the total supply with getTotalSupply() is correct", async () => {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check user balance has updated:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);
            // total supply should equal 1+2+3+4+5=15 
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(15);
        });

        it("check transfer in between users works", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // check balance before of user who'll receive the tokens:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
            // transfers happen
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 1, 1, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 3, 3, "0x");
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 4, 4, "0x");
            // he may not transfer all his balance of some particular token id
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 1000, 4, "0x");

            // check someone else balance after:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(4);

            // check the new owner has approved the admins
            for (let i = 0; i < await bluebellTokenContract.adminsLength(); i++) {
                expect(await bluebellTokenContract.isApprovedForAll(secondUser.address, await bluebellTokenContract.admins(i))).to.eq(true);
            }

            // check who transferred the tokens has had its balance diminished
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(1);
        });

        it("check batchTransfer in between users works", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // check balance before of user who'll receive the tokens:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(0);
            // transfers happen
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 3, 4, 1000], [1, 1, 1, 1, 2], "0x");

            // check someone else balance after:
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 3)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 4)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(2);

            // check the new owner has approved the admins
            for (let i = 0; i < await bluebellTokenContract.adminsLength(); i++) {
                expect(await bluebellTokenContract.isApprovedForAll(secondUser.address, await bluebellTokenContract.admins(i))).to.eq(true);
            }

            // check who transferred the tokens has had its balance diminished
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(3);
        });
    });

    describe("Vesting", function () {
        it("transfer from admins should work regardless of release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
        });

        it("transfer from owners or approved for tokens should not work if release time is not over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await expect(bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, ethers.constants.HashZero)).to.be.reverted;
        });

        it("transfer from owners or approved for tokens should work once  release time is over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await bluebellTokenContract.connect(firstUser).safeTransferFrom(firstUser.address, secondUser.address, 2, 2, ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
        });

        it("transferBatch from admins should work regardless of release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
        });

        it("transferBatch from owners or approved for tokens should not work if release time is not over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2], [1, 2], ethers.constants.HashZero)).to.be.reverted;
        });

        it("transferBatch from owners or approved for tokens should work once release time is over", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);

            // non-admin, owner of the token can't transfer them.
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2], [1, 2], ethers.constants.HashZero);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);

            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
        });

        it("modifyReleaseTime should modify releaseTime if called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            await bluebellTokenContract.modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);

            // after modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            //unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.lt((await ethers.provider.getBlock()).timestamp);
        });

        it("modifyReleaseTime should not modify releaseTime if not called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            await expect(bluebellTokenContract.connect(firstUser).modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime])).to.be.reverted;

            // no modification was made
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);
        });

        it("modifyReleaseTime should allow for transfers if new releaseTime is set to a past timestmap", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // modifying modifyReleaseTime
            const newReleaseTime = (await ethers.provider.getBlock()).timestamp - 100;
            await bluebellTokenContract.connect(deployer).modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);
            await bluebellTokenContract.connect(secondAdmin).modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).modifyReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000], [newReleaseTime, newReleaseTime, newReleaseTime]);

            // after modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.lt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.lt((await ethers.provider.getBlock()).timestamp);

            //unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);

            // transfer modified, but do not transfer unmodified
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(5);

            // revert when trying to transfer unmodified
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [3, 4], [3, 4], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });

        it("endReleaseTime should make token available if called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');

            // reset endReleaseTime
            await bluebellTokenContract.endReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000]);

            // after endReleaseTime
            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero);

            // unmodified ids
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);

            // check theyve been transferred.
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 1000)).to.eq(5);

            // revert when trying to transfer unmodified
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [3, 4], [3, 4], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });

        it("endReleaseTime should not make token available if not called by an admin", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // before modifyReleaseTime
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');

            // reset endReleaseTime
            await expect(bluebellTokenContract.connect(secondUser).endReleaseTime([firstUser.address, firstUser.address, firstUser.address], [1, 2, 1000])).to.be.reverted;

            // after endReleaseTime by an unauthorized user 
            // revert when trying to transfer incomplete
            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, secondUser.address, [1, 2, 1000], [1, 2, 5], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'IncompleteVesting');
        });
    });

    describe("Token Transfers", function () {
        it("transfer on paused should not work for non-admins", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'Paused');
        });

        it("transfer on paused should work for admins", async function () {
            await bluebellTokenContract.connect(deployer).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1);

            await bluebellTokenContract.connect(secondAdmin).safeBatchTransferFrom(secondAdmin.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("transfer on paused should not work for non-admins even if release time is over", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await expect(bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero)).to.be.revertedWithCustomError(bluebellTokenContract, 'Paused');
        });

        it("transfer on unpaused should work if release time is over", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            await bluebellTokenContract.connect(secondAdmin).unpause();

            await bluebellTokenContract.connect(firstUser).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("transfer for admins should work regardless releaseTime and contract being paused simultaneously ", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            // release time is not over.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // contract is paused && release time has not been reached, yet admin can transfer tokens.
            await bluebellTokenContract.connect(thirdAdmin).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);
        });

        it("transferBatch for admins should work regardless releaseTime and contract being paused simultaneously", async function () {
            await bluebellTokenContract.connect(secondAdmin).pause();

            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);

            // release time is not over.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // contract is paused && release time has not been reached, yet admin can transfer tokens.
            await bluebellTokenContract.connect(thirdAdmin).safeBatchTransferFrom(firstUser.address, deployer.address, [1], [1], ethers.constants.HashZero);
        });

        it("batch transfer to many people at once should work for admins from any user", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            await bluebellTokenContract.connect(deployer).adminTransfer(firstUser.address, [deployer.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [releaseTime, releaseTime, releaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
        });
    });

    describe("Burning of Tokens", function () {
        it("admins may burn tokens from themselves and users", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(deployer).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(deployer).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("users cannot burn their own tokens", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // burnBatch
            await expect(bluebellTokenContract.connect(firstUser).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4])).to.be.reverted;

            // burnToken
            await expect(bluebellTokenContract.connect(firstUser).burnToken(firstUser.address, 1000, 5)).to.be.reverted;
        });

        it("admins may burn before vesting scheduled time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // expect the release time to be far in the future
            expect(releaseTime).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(deployer).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // expect the release time to be far in the future
            expect(releaseTime).to.be.gt((await ethers.provider.getBlock()).timestamp);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(deployer).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("admins may burn after vesting schedules time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp - 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // expect the release time to be far in the past
            expect(releaseTime).to.be.lt((await ethers.provider.getBlock()).timestamp);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(deployer).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // expect the release time to be far in the past
            expect(releaseTime).to.be.lt((await ethers.provider.getBlock()).timestamp);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(deployer).burnToken(firstUser.address, 1000, 5);

            // check been burned
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(0);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(0);
        });

        it("burn correctly diminishes the totalSupply for the burned token", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            // check tokens been minted
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // before burn
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(15);

            // burnBatch
            await bluebellTokenContract.connect(thirdAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(deployer).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);
            await bluebellTokenContract.connect(secondAdmin).burnBatch(firstUser.address, [1, 2, 3, 4], [1, 2, 3, 4]);

            // after first burn 
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(5);

            // function overloading issue, that's why we call it this way on hardhat/ethers.
            // https://github.com/ethers-io/ethers.js/issues/407
            expect(await bluebellTokenContract["totalSupply(uint256)"](1000)).to.eq(5);

            // burnToken
            await bluebellTokenContract.connect(thirdAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(secondAdmin).burnToken(firstUser.address, 1000, 5);
            await bluebellTokenContract.connect(deployer).burnToken(firstUser.address, 1000, 5);

            // after second burn
            expect(await bluebellTokenContract.getTotalSupply()).to.eq(0);
            expect(await bluebellTokenContract["totalSupply(uint256)"](1000)).to.eq(0);
        });
    });

    describe("Traditional Journey", function () {
        it("admins should mint for themselves regardless release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 1000;

            // admin mints for himself.
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], deployer.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.gt(0);

            // check admin has release time set, i.e., it's not 0.
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // yet they can transfer.
            await bluebellTokenContract.connect(deployer).safeTransferFrom(deployer.address, firstUser.address, 1, 1, ethers.constants.HashZero);

            // check new owner has a zeroed vesting schedule.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.eq(0);
        });

        it("admins should mint to anyone regardless release time", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 1000;

            // admin mints for himself.
            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.gt(0);

            // check admin has release time set, i.e., it's not 0.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 4)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1000)).to.gt((await ethers.provider.getBlock()).timestamp);

            // yet they can transfer.
            await bluebellTokenContract.connect(deployer).safeTransferFrom(firstUser.address, deployer.address, 1, 1, ethers.constants.HashZero);
            await bluebellTokenContract.connect(deployer).safeTransferFrom(deployer.address, secondUser.address, 1, 1, ethers.constants.HashZero);

            //NOTE: if this situation happens the user won't have their vestingSchedule zeroed-out. That's why the owners should call the `modify` or `end` releaseTime functions.
        });

        it("admins should batch transfer to anyone and the receiver should have their vesting schedule updated", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], firstUser.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1000)).to.eq(5);

            // empty tokens 1, 2 and 3 from firstUser
            await bluebellTokenContract.connect(deployer).adminTransfer(firstUser.address, [deployer.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [releaseTime, releaseTime, releaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(deployer.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp, yet admin can transfer tokens anywhere, including himself.
            expect(await bluebellTokenContract.vestingSchedules(deployer.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);
        });

        it("admins should batch transfer from admins and receivers should have their vesting schedules updated", async function () {
            const releaseTime = (await ethers.provider.getBlock()).timestamp + 100;
            const updatedReleaseTime = (await ethers.provider.getBlock()).timestamp + 500;

            await bluebellTokenContract.connect(deployer).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(secondAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);
            await bluebellTokenContract.connect(thirdAdmin).mintBatch([1, 2, 3, 4, 1000], [1, 2, 3, 4, 5], secondAdmin.address, [releaseTime, releaseTime, releaseTime, releaseTime, releaseTime]);

            //check `from` user balance before transfer:
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 3)).to.eq(3);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 4)).to.eq(4);
            expect(await bluebellTokenContract.balanceOf(secondAdmin.address, 1000)).to.eq(5);

            // empty tokens 1, 2 and 3 from firstUser
            await bluebellTokenContract.connect(deployer).adminTransfer(secondAdmin.address, [firstUser.address, secondUser.address, thirdAdmin.address], [1, 2, 3], [updatedReleaseTime, updatedReleaseTime, updatedReleaseTime], [1, 2, 3]);

            expect(await bluebellTokenContract.balanceOf(firstUser.address, 1)).to.eq(1);
            expect(await bluebellTokenContract.balanceOf(secondUser.address, 2)).to.eq(2);
            expect(await bluebellTokenContract.balanceOf(thirdAdmin.address, 3)).to.eq(3);

            // vesting period should be bigger than current timestamp for the users who've received the tokens.
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.gt((await ethers.provider.getBlock()).timestamp);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.gt((await ethers.provider.getBlock()).timestamp);

            // vesting schedule should now be the specified time in the updated release time, not on the `mintBatch`
            expect(await bluebellTokenContract.vestingSchedules(firstUser.address, 1)).to.eq(updatedReleaseTime);
            expect(await bluebellTokenContract.vestingSchedules(secondUser.address, 2)).to.eq(updatedReleaseTime);
            expect(await bluebellTokenContract.vestingSchedules(thirdAdmin.address, 3)).to.eq(updatedReleaseTime);
        });

    });
});
