// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MeridianCore.sol";

contract Seed is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address coreAddress = vm.envAddress("MERIDIAN_CORE");

        vm.startBroadcast(deployerPrivateKey);

        MeridianCore core = MeridianCore(payable(coreAddress));

        uint256 durationBlocks = 50_000; // ~5.5 hours on Monad
        uint256 lpLiquidity = 0.5 ether; // per proposal

        // Create decision
        uint256 decisionId = core.createDecision(
            "Who should lead protocol development?",
            durationBlocks
        );
        console.log("Decision created:", decisionId);

        // Add proposals (each funded with real MON)
        core.addProposal{value: lpLiquidity}(decisionId, "Hire Alice");
        core.addProposal{value: lpLiquidity}(decisionId, "Hire Bob");
        core.addProposal{value: lpLiquidity}(decisionId, "Status Quo");
        console.log("3 proposals added (each with 0.5 MON liquidity)");

        // Deposit and trade
        core.deposit{value: 1 ether}(decisionId);
        console.log("Deposited 1 MON");

        core.split(decisionId, 0, 0.3 ether);
        core.split(decisionId, 1, 0.2 ether);
        console.log("Split into proposals 0 and 1");

        vm.stopBroadcast();
    }
}
