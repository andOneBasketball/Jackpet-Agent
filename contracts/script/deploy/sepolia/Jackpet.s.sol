// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/Test.sol";
import {Jackpet} from "../../../src/Jackpet.sol";

contract JackpetScript is Script {
    Jackpet public jackpet;
    address public vrfCoordinator =
        address(0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B);
    bytes32 public keyHash =
        0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;
    uint256 public subId =
        32385588637373844920823943478370010271717458688826519693091571058749410633259;
    uint256 public ticketFeeWei = 0.01 ether;
    uint32 public maxTicketRate = 10000;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        jackpet = new Jackpet(
            vrfCoordinator,
            keyHash,
            subId,
            ticketFeeWei,
            maxTicketRate
        );

        console.log(
            string.concat(
                "jackpet contract deployed, owner=",
                vm.toString(jackpet.owner())
            )
        );

        vm.stopBroadcast();
    }
}
