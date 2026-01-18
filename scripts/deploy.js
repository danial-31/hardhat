import 'dotenv/config';
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const initialSupply = ethers.parseUnits("1000", 18);
    const Token = await ethers.getContractFactory("MyToken");
    const token = await Token.deploy(initialSupply);

    await token.waitForDeployment();
    console.log("Token deployed to:", token.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
