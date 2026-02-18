// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MeridianCore.sol";

contract AddProposals is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address coreAddress = vm.envAddress("MERIDIAN_CORE");

        vm.startBroadcast(deployerPrivateKey);

        MeridianCore core = MeridianCore(payable(coreAddress));
        uint256 decisionId = 0;
        uint256 lp = 0.1 ether;

        core.addProposal{value: lp}(decisionId, "PizzaSlice");
        console.log("Added: PizzaSlice");

        core.addProposal{value: lp}(decisionId, "SliceBattle");
        console.log("Added: SliceBattle");

        core.addProposal{value: lp}(decisionId, "Ganja Mon");
        console.log("Added: Ganja Mon");

        core.addProposal{value: lp}(decisionId, "Thousand Monkeys, Thousand Typewriters");
        console.log("Added: Thousand Monkeys, Thousand Typewriters");

        vm.stopBroadcast();
    }
}
