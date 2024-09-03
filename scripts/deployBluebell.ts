// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {

    //signers + baseURI
    const bluebell = await hre.ethers.deployContract("BluebellToken", [["0xae50d903e6570CC983fEdeF94D35b3831f81E1a4", "0x21F1f8BCC864142C25e6CA7bB97A83dcab8bdedc", "0x2C6D2ec49091074Fa9eaeA7881Eed191f60f1BDf"], `https://gateway.pinata.cloud/ipfs/QmeUhYkuCfZJg2fCTFNG7YQMBqSGekU9wygKeQeKNmVgHv`, 3]);

    // below from: https://github.com/NomicFoundation/hardhat/releases/tag/%40nomicfoundation%2Fhardhat-toolbox%403.0.0
    await bluebell.deployed();

    console.log(
        `Bluebell token deployed to ${bluebell.target}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
