// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MeridianCore.sol";
import "../test/mocks/MockWelfareOracle.sol";

contract Seed is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address coreAddress = vm.envAddress("MERIDIAN_CORE");
        address oracleAddress = vm.envAddress("WELFARE_ORACLE");

        vm.startBroadcast(deployerPrivateKey);

        MeridianCore core = MeridianCore(payable(coreAddress));

        // ============ Mode A Decision (existing) ============

        uint256 virtualLiquidity = 10 ether;
        uint256 durationBlocks = 50_000; // ~5.5 hours on Monad

        uint256 decisionA = core.createDecision(
            "Who should lead protocol development?",
            durationBlocks,
            virtualLiquidity
        );
        console.log("Mode A Decision created:", decisionA);

        core.addProposal(decisionA, "Hire Alice");
        core.addProposal(decisionA, "Hire Bob");
        core.addProposal(decisionA, "Status Quo");
        console.log("3 proposals added to Mode A");

        core.deposit{value: 1 ether}(decisionA);
        console.log("Deposited 1 MON to Mode A");

        core.buyYes(decisionA, 0, 0.3 ether, 0);
        core.buyNo(decisionA, 1, 0.2 ether, 0);
        console.log("Mode A trades placed");

        // ============ Mode B Decision (new) ============

        address deployer = vm.addr(deployerPrivateKey);
        uint256 measurementPeriod = 200; // ~22 seconds on Monad
        uint256 minImprovement = 500; // 5% improvement required

        uint256 decisionB = core.createDecision(
            "Should we adopt new treasury strategy?",
            durationBlocks,
            virtualLiquidity,
            oracleAddress,
            measurementPeriod,
            minImprovement,
            deployer // deployer as guardian for testing
        );
        console.log("Mode B Decision created:", decisionB);

        core.addProposal(decisionB, "New Strategy");
        core.addProposal(decisionB, "Keep Current");
        console.log("2 proposals added to Mode B");

        core.deposit{value: 1 ether}(decisionB);
        console.log("Deposited 1 MON to Mode B");

        core.buyYes(decisionB, 0, 0.3 ether, 0);
        core.buyNo(decisionB, 0, 0.2 ether, 0);
        console.log("Mode B trades placed");

        vm.stopBroadcast();
    }
}
