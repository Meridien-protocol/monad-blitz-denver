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

        // ~3h10m at ~2.5 blocks/sec = ~28,500 blocks
        uint256 durationBlocks = 28_500;
        uint256 lpLiquidity = 0.1 ether; // MIN_LIQUIDITY per proposal

        // Create the hackathon decision
        uint256 decisionId = core.createDecision(
            "Who will win Monad Blitz?",
            durationBlocks
        );
        console.log("Decision created:", decisionId);

        // Seed proposals
        core.addProposal{value: lpLiquidity}(decisionId, "Meridian");
        console.log("Proposal 0: Meridian");

        core.addProposal{value: lpLiquidity}(decisionId, "CashMarket");
        console.log("Proposal 1: CashMarket");

        core.addProposal{value: lpLiquidity}(decisionId, "Pizza Sky Race");
        console.log("Proposal 2: Pizza Sky Race");

        vm.stopBroadcast();
    }
}
