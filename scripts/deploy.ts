import {ethers} from 'hardhat';

async function main() {
    const GoTokensPOAP = await ethers.getContractFactory('GoTokensPOAP');
    const goTokensPOAP = await GoTokensPOAP.deploy(
        ' MMA Smarties 2022 Gold',
        'SMGBR',
        '',
        '0x261cE559ec2768a622d46FBbFbd09478c1bc5e4F',
        '0x261cE559ec2768a622d46FBbFbd09478c1bc5e4F',
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
    );

    await goTokensPOAP.deployed();

    console.log(`Contract deployed to ${goTokensPOAP.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
