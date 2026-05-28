// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/MockUSDC.sol";
import "../contracts/SpendOSVault.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract MinimalTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 actual, uint256 expected, string memory label) internal pure {
        if (actual != expected) revert(label);
    }

    function assertEq(address actual, address expected, string memory label) internal pure {
        if (actual != expected) revert(label);
    }

    function assertTrue(bool value, string memory label) internal pure {
        if (!value) revert(label);
    }
}

contract SpendOSVaultTest is MinimalTest {
    uint256 internal constant OWNER_KEY = 0xA11CE;
    uint256 internal constant OPERATOR_KEY = 0xB0B;
    uint256 internal constant AGENT_KEY = 0xA9E17;

    MockUSDC internal usdc;
    SpendOSVault internal vault;

    address internal owner;
    address internal operator;
    address internal agentVault;
    address internal recipient = address(0xCAFE);

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        operator = vm.addr(OPERATOR_KEY);
        agentVault = vm.addr(AGENT_KEY);

        usdc = new MockUSDC();
        vault = new SpendOSVault(address(usdc));

        usdc.mint(owner, 100e6);

        _authorizeDefaultPolicy();

        vm.prank(owner);
        usdc.approve(address(vault), 25e6);
        vm.prank(owner);
        vault.fundAgent(agentVault, 25e6);
        vm.prank(owner);
        vault.setOperator(operator, true);
    }

    function testOwnerSignedPolicyRegistersAgent() public {
        (address registeredOwner, uint256 balance, uint256 dailyLimit, uint256 txLimit,,,, bytes32 digest) =
            vault.policies(agentVault);

        assertEq(registeredOwner, owner, "owner");
        assertEq(balance, 25e6, "funded balance");
        assertEq(dailyLimit, 10e6, "daily limit");
        assertEq(txLimit, 1e6, "tx limit");
        assertEq(uint256(digest), uint256(_policyDigest()), "digest");
    }

    function testOperatorCanSpendWithinPolicy() public {
        vm.prank(operator);
        vault.spendUSDC(agentVault, recipient, 420000, "risk.baseintel.net", keccak256("receipt-1"));

        assertEq(usdc.balanceOf(recipient), 420000, "recipient balance");

        (, uint256 balance,,, uint256 spentInWindow,,,) = vault.policies(agentVault);
        assertEq(balance, 25e6 - 420000, "remaining balance");
        assertEq(spentInWindow, 420000, "spent window");
    }

    function testSpendRejectsAboveTransactionLimit() public {
        vm.prank(operator);
        vm.expectRevert(SpendOSVault.PerTransactionLimitExceeded.selector);
        vault.spendUSDC(agentVault, recipient, 2e6, "deepindex.baseops.ai", keccak256("receipt-2"));
    }

    function testPauseBlocksSpend() public {
        vm.prank(owner);
        vault.setPaused(agentVault, true);

        vm.prank(operator);
        vm.expectRevert(SpendOSVault.AgentPausedError.selector);
        vault.spendUSDC(agentVault, recipient, 100000, "api.tokensight.io", keccak256("receipt-3"));
    }

    function testDailyWindowRollsAfterOneDay() public {
        vm.prank(operator);
        vault.spendUSDC(agentVault, recipient, 1e6, "api.tokensight.io", keccak256("receipt-4"));

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(operator);
        vault.spendUSDC(agentVault, recipient, 1e6, "api.tokensight.io", keccak256("receipt-5"));

        (,,,, uint256 spentInWindow,,,) = vault.policies(agentVault);
        assertEq(spentInWindow, 1e6, "rolled spent window");
    }

    function testNonOperatorCannotSpend() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(SpendOSVault.NotAuthorizedOperator.selector);
        vault.spendUSDC(agentVault, recipient, 100000, "api.tokensight.io", keccak256("receipt-6"));
    }

    function _authorizeDefaultPolicy() internal {
        bytes32 digest = _policyDigest();
        bytes32 messageHash = vault.policyMessageHash(agentVault, 10e6, 1e6, digest);
        bytes32 signedHash = vault.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, signedHash);

        vault.authorizePolicy(agentVault, 10e6, 1e6, digest, abi.encodePacked(r, s, v));
    }

    function _policyDigest() internal pure returns (bytes32) {
        return keccak256("research-agent:base-usdc:10:1:allowlisted-v1");
    }
}
