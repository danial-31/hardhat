const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyToken", function () {
  let Token, token, deployer;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MyToken");
    token = await Token.deploy(ethers.parseUnits("1000", 18));
    await token.waitForDeployment();
  });

  it("should assign initial supply to deployer", async function () {
    const balance = await token.balanceOf(deployer.address);
    expect(balance).to.equal(ethers.parseUnits("1000", 18));
  });

  it("should have correct name and symbol", async function () {
    expect(await token.name()).to.equal("MyToken");
    expect(await token.symbol()).to.equal("MTK");
  });

  it("should transfer tokens", async function () {
    const [_, addr1] = await ethers.getSigners();
    await token.transfer(addr1.address, ethers.parseUnits("100", 18));
    expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseUnits("100", 18));
  });
});
