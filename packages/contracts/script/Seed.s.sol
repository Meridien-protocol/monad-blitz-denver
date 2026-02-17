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

        // Create a sample decision
        uint256 virtualLiquidity = 10 ether;
        uint256 durationBlocks = 50_000; // ~5.5 hours on Monad

        uint256 decisionId = core.createDecision("Who should lead protocol development?", durationBlocks, virtualLiquidity);
        console.log("Decision created:", decisionId);

        // Add proposals
        core.addProposal(decisionId, "Hire Alice");
        core.addProposal(decisionId, "Hire Bob");
        core.addProposal(decisionId, "Status Quo");
        console.log("3 proposals added");

        // Deposit and make initial trades
        core.deposit{value: 5 ether}(decisionId);
        console.log("Deposited 5 MON");

        core.buyYes(decisionId, 0, 1 ether, 0); // Buy YES on Alice
        core.buyNo(decisionId, 1, 0.5 ether, 0); // Buy NO on Bob
        console.log("Initial trades placed");

        vm.stopBroadcast();
    }
}
