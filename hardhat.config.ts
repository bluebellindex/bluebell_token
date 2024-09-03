import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-solhint';
require('dotenv').config({ path: __dirname + '/.env' });

const COMPILERS = [
    { version: "0.8.0" },
    { version: "0.8.18" },
    { version: "0.8.14" },
    { version: "0.8.21" },
    { version: "0.8.23" },
];

const settings = {
    optimizer: {
        enabled: true,
        runs: 20,
    },
};
const config = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            gas: 12000000,
            allowUnlimitedContractSize: true,
        },
        sepolia: {
            url: process.env.SEPOLIA_URL,
            accounts: [process.env.PK]
        }
    },
    solidity: {
        // below from: https://github.com/NomicFoundation/hardhat/issues/2254
        compilers: COMPILERS.map((el) => ({ ...el, settings })),
    },
    etherscan: {
        apiKey: "CIPAPA4HNESG85YWHQZK8EC11QJY4DE12Q",
    },
};
export default config;