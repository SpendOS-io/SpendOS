// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/SpendOSVault.sol";

interface ScriptVm {
    function envAddress(string calldata key) external returns (address);
    function envUint(string calldata key) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeploySpendOSVault {
    ScriptVm internal constant vm = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SpendOSVault vault) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerKey);
        vault = new SpendOSVault(usdc);
        vm.stopBroadcast();
    }
}
