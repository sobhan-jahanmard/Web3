import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import path from "path";

dotenv.config({ path: path.join(__dirname, ".env") });

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_URL!, // Ethereum RPC URL (Alchemy or Infura)
        blockNumber: 21750861, // Ethereum block number to fork from
      },
    },
    // hardhat: {
    //   forking: {
    //     url: process.env.BNB_MAINNET_FORM_IN_ALCHEMY!, // Alchemy BSC RPC URL
    //   },
    //   chainId: 56, // Chain ID for BSC
    // },
    // sepolia: {
    //   url: process.env.ALCHEMY_SEPOLIA_URL!, // Replace with your Alchemy API key
    //   accounts: [process.env.SOBHAN_METAMASK_TEST_SEPOLIA_ACCOUNT || ""], // Replace with your wallet private key (use dotenv for security)
    //   timeout: 300000,
    // },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 20, // In gwei
    token: "ETH", // Optionally specify the token for conversion
    showTimeSpent: true, // Optionally show time spent per transaction
    coinmarketcap: process.env.COINMARKETCAP_API_KEY, // Get this from https://coinmarketcap.com/api/
    outputFile: "gas-report.txt",
    noColors: true,
  },
};

export default config;
