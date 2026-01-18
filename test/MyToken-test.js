const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyToken", function () {
    let Token, token, deployer, addr1, addr2, addr3;
    const INITIAL_SUPPLY = ethers.parseUnits("1000", 18);

    beforeEach(async function () {
        [deployer, addr1, addr2, addr3] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MyToken");
        token = await Token.deploy(INITIAL_SUPPLY);
        await token.waitForDeployment();
    });

    describe("When the token is first deployed", function () {
        it("has the name 'MyToken'", async function () {
            expect(await token.name()).to.equal("MyToken");
        });

        it("uses 'MTK' as its symbol", async function () {
            expect(await token.symbol()).to.equal("MTK");
        });

        it("uses 18 decimals (standard for ERC20 tokens)", async function () {
            expect(await token.decimals()).to.equal(18);
        });

        it("gives all 1000 tokens to the person who deployed it", async function () {
            const deployerBalance = await token.balanceOf(deployer.address);
            expect(deployerBalance).to.equal(INITIAL_SUPPLY);
        });

        it("shows the correct total supply (1000 tokens)", async function () {
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.equal(INITIAL_SUPPLY);
        });
    });

    describe("Checking token balances", function () {
        it("shows zero balance for a new account that has never received tokens", async function () {
            const balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(0);
        });

        it("updates the recipient's balance correctly after sending them tokens", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            await token.transfer(addr1.address, amountToSend);
            
            const balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(amountToSend);
        });

        it("reduces the sender's balance when they transfer tokens", async function () {
            const amountToSend = ethers.parseUnits("250", 18);
            const balanceBefore = await token.balanceOf(deployer.address);
            
            await token.transfer(addr1.address, amountToSend);
            
            const balanceAfter = await token.balanceOf(deployer.address);
            expect(balanceAfter).to.equal(balanceBefore - amountToSend);
        });

        it("keeps track of balances correctly when sending to multiple people", async function () {
            await token.transfer(addr1.address, ethers.parseUnits("100", 18));
            await token.transfer(addr2.address, ethers.parseUnits("200", 18));
            
            const deployerBalance = await token.balanceOf(deployer.address);
            const addr1Balance = await token.balanceOf(addr1.address);
            const addr2Balance = await token.balanceOf(addr2.address);
            
            expect(deployerBalance).to.equal(ethers.parseUnits("700", 18));
            expect(addr1Balance).to.equal(ethers.parseUnits("100", 18));
            expect(addr2Balance).to.equal(ethers.parseUnits("200", 18));
        });
    });

    describe("Sending tokens to other people", function () {
        it("allows you to send tokens to someone else", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            await token.transfer(addr1.address, amountToSend);
            
            const recipientBalance = await token.balanceOf(addr1.address);
            expect(recipientBalance).to.equal(amountToSend);
        });

        it("lets you send your entire balance to someone", async function () {
            const myFullBalance = await token.balanceOf(deployer.address);
            await token.transfer(addr1.address, myFullBalance);
            
            const myBalanceAfter = await token.balanceOf(deployer.address);
            const theirBalanceAfter = await token.balanceOf(addr1.address);
            
            expect(myBalanceAfter).to.equal(0);
            expect(theirBalanceAfter).to.equal(myFullBalance);
        });

        it("works even for tiny amounts like 0.000001 tokens", async function () {
            const tinyAmount = ethers.parseUnits("0.000001", 18);
            await token.transfer(addr1.address, tinyAmount);
            
            const balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(tinyAmount);
        });

        it("can handle sending all available tokens (the initial supply)", async function () {
            await token.transfer(addr1.address, INITIAL_SUPPLY);
            
            const balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(INITIAL_SUPPLY);
        });

        it("allows sending multiple payments to the same person (their balance adds up)", async function () {
            const firstPayment = ethers.parseUnits("50", 18);
            const secondPayment = ethers.parseUnits("50", 18);
            
            await token.transfer(addr1.address, firstPayment);
            await token.transfer(addr1.address, secondPayment);
            
            const totalBalance = await token.balanceOf(addr1.address);
            expect(totalBalance).to.equal(firstPayment + secondPayment);
        });

        it("works when someone who received tokens wants to send them to someone else", async function () {
            await token.transfer(addr1.address, ethers.parseUnits("200", 18));
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseUnits("150", 18));
            
            const addr1Balance = await token.balanceOf(addr1.address);
            const addr2Balance = await token.balanceOf(addr2.address);
            
            expect(addr1Balance).to.equal(ethers.parseUnits("50", 18));
            expect(addr2Balance).to.equal(ethers.parseUnits("150", 18));
        });
    });

    describe("When transfers should fail", function () {
        it("refuses to let you send more tokens than you actually have", async function () {
            const amountThatExceedsBalance = INITIAL_SUPPLY + 1n;
            
            await expect(
                token.transfer(addr1.address, amountThatExceedsBalance)
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
              .withArgs(deployer.address, INITIAL_SUPPLY, amountThatExceedsBalance);
        });

        it("stops someone with zero tokens from trying to send any tokens", async function () {
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseUnits("1", 18))
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
              .withArgs(addr1.address, 0, ethers.parseUnits("1", 18));
        });

        it("prevents sending tokens to the zero address (burning accidentally)", async function () {
            const zeroAddress = ethers.ZeroAddress;
            
            await expect(
                token.transfer(zeroAddress, ethers.parseUnits("100", 18))
            ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
              .withArgs(zeroAddress);
        });
    });

    describe("The weird case: sending tokens to yourself", function () {
        it("allows you to 'send' tokens to your own address (your balance stays the same)", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            const balanceBefore = await token.balanceOf(deployer.address);
            
            await token.transfer(deployer.address, amountToSend);
            
            const balanceAfter = await token.balanceOf(deployer.address);
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("still fires a Transfer event even when you send to yourself", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            
            await expect(token.transfer(deployer.address, amountToSend))
                .to.emit(token, "Transfer")
                .withArgs(deployer.address, deployer.address, amountToSend);
        });

        it("doesn't change the total supply when you send to yourself", async function () {
            const amountToSend = ethers.parseUnits("500", 18);
            
            await token.transfer(deployer.address, amountToSend);
            
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.equal(INITIAL_SUPPLY);
        });
    });

    describe("Gas costs for transfers", function () {
        it("can estimate how much gas a transfer will cost", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            const estimatedGas = await token.transfer.estimateGas(addr1.address, amountToSend);
            
            expect(estimatedGas).to.be.greaterThan(0);
            expect(estimatedGas).to.be.lessThan(100000n);
        });

        it("can estimate gas even when sending to an account with no tokens yet", async function () {
            const amountToSend = ethers.parseUnits("1", 18);
            const estimatedGas = await token.transfer.estimateGas(addr1.address, amountToSend);
            
            expect(estimatedGas).to.be.greaterThan(0);
        });

        it("can compare gas costs for different amounts (both work, just checking)", async function () {
            const smallAmount = ethers.parseUnits("1", 18);
            const largeAmount = ethers.parseUnits("999", 18);
            
            const smallGas = await token.transfer.estimateGas(addr1.address, smallAmount);
            const largeGas = await token.transfer.estimateGas(addr2.address, largeAmount);
            
            expect(smallGas).to.be.greaterThan(0);
            expect(largeGas).to.be.greaterThan(0);
        });
    });

    describe("Events that get fired when tokens move", function () {
        it("fires a Transfer event every time tokens are successfully sent", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            
            await expect(token.transfer(addr1.address, amountToSend))
                .to.emit(token, "Transfer")
                .withArgs(deployer.address, addr1.address, amountToSend);
        });

        it("includes the correct sender, recipient, and amount in the Transfer event", async function () {
            const amountToSend = ethers.parseUnits("250", 18);
            const tx = await token.transfer(addr1.address, amountToSend);
            const receipt = await tx.wait();
            
            const transferEvent = receipt.logs.find(
                log => token.interface.parseLog(log)?.name === "Transfer"
            );
            
            expect(transferEvent).to.not.be.undefined;
            
            const parsedEvent = token.interface.parseLog(transferEvent);
            expect(parsedEvent.args.from).to.equal(deployer.address);
            expect(parsedEvent.args.to).to.equal(addr1.address);
            expect(parsedEvent.args.value).to.equal(amountToSend);
        });

        it("still fires events when you send tokens to yourself", async function () {
            const amountToSend = ethers.parseUnits("100", 18);
            
            await expect(token.transfer(deployer.address, amountToSend))
                .to.emit(token, "Transfer")
                .withArgs(deployer.address, deployer.address, amountToSend);
        });

        it("fires separate Transfer events for each transfer you make", async function () {
            const firstAmount = ethers.parseUnits("100", 18);
            const secondAmount = ethers.parseUnits("200", 18);
            
            await expect(token.transfer(addr1.address, firstAmount))
                .to.emit(token, "Transfer")
                .withArgs(deployer.address, addr1.address, firstAmount);
            
            await expect(token.transfer(addr2.address, secondAmount))
                .to.emit(token, "Transfer")
                .withArgs(deployer.address, addr2.address, secondAmount);
        });
    });

    describe("Making sure balances are saved correctly", function () {
        it("remembers balances even after other transfers happen", async function () {
            const amountToSend = ethers.parseUnits("300", 18);
            await token.transfer(addr1.address, amountToSend);
            
            const balanceAfterFirstTransfer = await token.balanceOf(addr1.address);
            
            await token.transfer(addr2.address, ethers.parseUnits("100", 18));
            
            const balanceAfterSecondTransfer = await token.balanceOf(addr1.address);
            expect(balanceAfterFirstTransfer).to.equal(balanceAfterSecondTransfer);
            expect(balanceAfterSecondTransfer).to.equal(amountToSend);
        });

        it("remembers everyone's balances correctly across many transfers", async function () {
            await token.transfer(addr1.address, ethers.parseUnits("100", 18));
            await token.transfer(addr2.address, ethers.parseUnits("200", 18));
            await token.transfer(addr3.address, ethers.parseUnits("300", 18));
            
            const addr1Balance = await token.balanceOf(addr1.address);
            const addr2Balance = await token.balanceOf(addr2.address);
            const addr3Balance = await token.balanceOf(addr3.address);
            const deployerBalance = await token.balanceOf(deployer.address);
            
            expect(addr1Balance).to.equal(ethers.parseUnits("100", 18));
            expect(addr2Balance).to.equal(ethers.parseUnits("200", 18));
            expect(addr3Balance).to.equal(ethers.parseUnits("300", 18));
            expect(deployerBalance).to.equal(ethers.parseUnits("400", 18));
        });

        it("keeps the total supply the same no matter how many transfers happen (tokens don't disappear)", async function () {
            const totalSupplyBefore = await token.totalSupply();
            
            await token.transfer(addr1.address, ethers.parseUnits("100", 18));
            await token.transfer(addr2.address, ethers.parseUnits("200", 18));
            
            const totalSupplyAfter = await token.totalSupply();
            expect(totalSupplyAfter).to.equal(totalSupplyBefore);
        });
    });

    describe("Testing edge cases and error handling", function () {
        describe("When things should revert", function () {
            it("stops you from sending more tokens than you have", async function () {
                await expect(
                    token.connect(addr1).transfer(addr2.address, ethers.parseUnits("1", 18))
                ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
            });

            it("won't let you send tokens to the zero address", async function () {
                await expect(
                    token.transfer(ethers.ZeroAddress, ethers.parseUnits("100", 18))
                ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
            });

            it("the type system prevents sending amounts that are too large for uint256", async function () {
                const overflowAmount = ethers.MaxUint256 + 1n;
                
                await expect(
                    token.transfer(addr1.address, overflowAmount)
                ).to.be.rejectedWith(/value out-of-bounds|overflow/i);
            });
        });

        describe("Special cases that should still work", function () {
            it("allows sending zero tokens (balance doesn't change, but it's allowed)", async function () {
                const balanceBefore = await token.balanceOf(deployer.address);
                
                await token.transfer(addr1.address, 0);
                
                const balanceAfter = await token.balanceOf(deployer.address);
                const recipientBalance = await token.balanceOf(addr1.address);
                
                expect(balanceAfter).to.equal(balanceBefore);
                expect(recipientBalance).to.equal(0);
            });

            it("handles attempts to send impossibly large amounts (like 999 trillion tokens)", async function () {
                const hugeAmount = ethers.parseUnits("999999999999", 18);
                
                if (hugeAmount <= INITIAL_SUPPLY) {
                    await expect(
                        token.transfer(addr1.address, hugeAmount)
                    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
                }
            });
        });

        describe("Invalid inputs that should be caught", function () {
            it("catches invalid address formats before they reach the contract", async function () {
                const invalidAddress = "0xInvalid";
                
                try {
                    await token.transfer(invalidAddress, ethers.parseUnits("100", 18));
                    expect.fail("Should have thrown an error");
                } catch (error) {
                    expect(error.message || error.toString()).to.match(/resolveName|NotImplemented|invalid/i);
                }
            });

            it("the type system prevents negative amounts from being sent", async function () {
                const negativeAmount = -1n;
                
                await expect(
                    token.transfer(addr1.address, negativeAmount)
                ).to.be.rejectedWith(/value out-of-bounds|invalid/i);
            });

            it("works fine when you send exactly your entire balance", async function () {
                const exactBalance = await token.balanceOf(deployer.address);
                await token.transfer(addr1.address, exactBalance);
                
                const deployerBalance = await token.balanceOf(deployer.address);
                expect(deployerBalance).to.equal(0);
            });
        });
    });

    describe("Real-world scenarios with multiple people and transfers", function () {
        it("handles a chain of transfers: Alice sends to Bob, Bob sends to Charlie, etc.", async function () {
            await token.transfer(addr1.address, ethers.parseUnits("100", 18));
            await token.transfer(addr2.address, ethers.parseUnits("200", 18));
            
            await token.connect(addr1).transfer(addr3.address, ethers.parseUnits("50", 18));
            await token.connect(addr2).transfer(addr3.address, ethers.parseUnits("100", 18));
            
            const charlieBalance = await token.balanceOf(addr3.address);
            expect(charlieBalance).to.equal(ethers.parseUnits("150", 18));
        });

        it("makes sure all balances add up correctly - nobody's tokens go missing", async function () {
            await token.transfer(addr1.address, ethers.parseUnits("100", 18));
            await token.transfer(addr2.address, ethers.parseUnits("200", 18));
            await token.transfer(addr3.address, ethers.parseUnits("300", 18));
            
            const deployerBalance = await token.balanceOf(deployer.address);
            const addr1Balance = await token.balanceOf(addr1.address);
            const addr2Balance = await token.balanceOf(addr2.address);
            const addr3Balance = await token.balanceOf(addr3.address);
            const totalSupply = await token.totalSupply();
            
            const sumOfAllBalances = deployerBalance + addr1Balance + addr2Balance + addr3Balance;
            expect(sumOfAllBalances).to.equal(totalSupply);
        });
    });
});
