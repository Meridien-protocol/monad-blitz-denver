// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MeridianCore.sol";
import "../test/mocks/MockWelfareOracle.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MeridianCore core = new MeridianCore();
        console.log("MeridianCore deployed at:", address(core));

        MockWelfareOracle oracle = new MockWelfareOracle();
        console.log("MockWelfareOracle deployed at:", address(oracle));

        // Set initial metric value
        oracle.setMetric(1000);
        console.log("Oracle baseline metric set to 1000");

        vm.stopBroadcast();
    }
}
