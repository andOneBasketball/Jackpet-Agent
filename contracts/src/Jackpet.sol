// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

/**
 * Jackpet - Chainlink VRF v2.5 powered pet lottery
 *
 * Game rules (defaults):
 * - There are 24 pets total: 8 Red, 8 Blue, 8 Yellow.
 * - A player draws 12 unique pets at random.
 * - Ticket fee: 0.01 ether (BNB on BNB Chain).
 * - If the color counts are {8,4,0} in any color order: pay 0.11 ether to the player.
 * - If the color counts are {5,4,3} in any color order: no payout (ticket lost).
 * - All other outcomes: no payout (ticket lost) unless configured via rules.
 *
 * Config management:
 * - Anyone can add a rule (pattern + payout).
 * - Only owner can remove a rule.
 *
 * Randomness:
 * - Uses Chainlink VRF v2.5 official contracts via imports with extraArgs/native payment.
 */

import {
    VRFConsumerBaseV2Plus
} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {
    VRFV2PlusClient
} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {
    IVRFCoordinatorV2Plus
} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFCoordinatorV2_5.sol";

contract Jackpet is VRFConsumerBaseV2Plus {
    // Ticket fee and default payout configured in constructor
    uint256 public ticketFeeWei;

    // Jackpot pool configuration
    uint256 public jackpotPool = 0; // Total jackpot pool balance
    uint256 public jackpotContributionRate = 100; // losing tickets go to jackpot (in basis points, 10000 = 100%)
    uint256 public constant MAX_CONTRIBUTION_RATE = 5000; // Max 50%

    uint32 public maxTicketRate;

    // Chainlink VRF v2.5 config (set in constructor)
    IVRFCoordinatorV2Plus private immutable coordinator;
    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint16 public requestConfirmations = 3;
    uint32 public callbackGasLimit = 500000;
    uint32 public constant NUM_WORDS = 1;
    bool public useNativePayment = true; // v2.5 supports native LINKless payments on supported chains

    // Game constants
    uint8 private constant DRAWS = 12;
    // Pet color template stored once in storage and reused each draw
    // Indices 0..7 => color 0, 8..15 => color 1, 16..23 => color 2
    uint8[24] public poolTemplate;

    // Rules keyed by a packed sorted triple (a>=b>=c) with a+b+c = 12
    struct Rule {
        bool exists;
        uint256 payoutWei; // 0 for loss, >0 for payout
        uint256 jackpotShare; // Percentage of jackpot pool to distribute (in basis points)
    }

    mapping(uint24 => Rule) public rulesByKey;

    // Play request state
    struct PlayRequest {
        address player;
        uint256 paid;
        uint32 ticketRate;
    }

    mapping(uint256 => PlayRequest) public requests; // requestId => request

    // Stored play outcomes so frontends can poll by requestId after calling `play`
    struct PlayOutcome {
        bool settled;
        address player;
        uint8 a;
        uint8 b;
        uint8 c;
        uint32 ticketRate;
        uint256 payoutWei;
        uint256 jackpotPayout;
        uint256 timestamp;
    }

    mapping(uint256 => PlayOutcome) public outcomes; // requestId => outcome

    // Events
    event TicketFeeUpdated(uint256 oldFee, uint256 newFee);
    event VRFConfigUpdated(
        bytes32 keyHash,
        uint256 subscriptionId,
        uint16 confirmations,
        uint32 callbackGasLimit
    );
    event RuleAdded(
        uint24 key,
        uint8 a,
        uint8 b,
        uint8 c,
        uint256 payoutWei,
        uint256 jackpotShare,
        address indexed addedBy
    );
    event RuleRemoved(uint24 key, address indexed removedBy);
    event PlayRequested(
        uint256 indexed requestId,
        address indexed player,
        uint256 paid
    );
    event PlayResult(
        uint256 indexed requestId,
        address indexed player,
        uint8 a,
        uint8 b,
        uint8 c,
        uint32 ticketRate,
        uint256 payoutWei,
        uint256 jackpotPayout
    );
    event FundsWithdrawn(address indexed to, uint256 amount);
    event Deposited(address indexed depositor, uint256 amount);
    event JackpotContribution(uint256 amount, uint256 newPoolBalance);
    event JackpotDistributed(uint256 amount, address indexed player);
    event JackpotConfigUpdated(uint256 contributionRate);

    constructor(
        address vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint256 _ticketFeeWei,
        uint32 _maxTicketRate
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        coordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        ticketFeeWei = _ticketFeeWei;
        maxTicketRate = _maxTicketRate;
        // Initialize pool template once
        unchecked {
            for (uint8 t = 0; t < 24; t++) {
                poolTemplate[t] = t < 8 ? 0 : (t < 16 ? 1 : 2);
            }
        }
        // Default rules
        // Win: any permutation of {8,4,0} pays 10*ticketFeeWei ether + 99% of jackpot
        _addRuleInternal(
            _packSorted(8, 4, 0),
            8,
            4,
            0,
            _ticketFeeWei * 11,
            9900
        );
        _addRuleInternal(
            _packSorted(8, 3, 1),
            8,
            3,
            1,
            _ticketFeeWei * 6,
            3000
        );
        _addRuleInternal(
            _packSorted(8, 2, 2),
            8,
            2,
            2,
            _ticketFeeWei * 6,
            3000
        );
        _addRuleInternal(
            _packSorted(7, 5, 0),
            7,
            5,
            0,
            _ticketFeeWei * 6,
            3000
        );
        _addRuleInternal(
            _packSorted(7, 4, 1),
            7,
            4,
            1,
            _ticketFeeWei * 4,
            1000
        );
        _addRuleInternal(
            _packSorted(7, 3, 2),
            7,
            3,
            2,
            _ticketFeeWei * 2,
            1000
        );
        _addRuleInternal(
            _packSorted(6, 6, 0),
            6,
            6,
            0,
            _ticketFeeWei * 6,
            3000
        );
        _addRuleInternal(
            _packSorted(6, 5, 1),
            6,
            5,
            1,
            _ticketFeeWei * 2,
            1000
        );
        _addRuleInternal(
            _packSorted(6, 4, 2),
            6,
            4,
            2,
            _ticketFeeWei + _ticketFeeWei / 10,
            0
        );
        _addRuleInternal(
            _packSorted(6, 3, 3),
            6,
            3,
            3,
            _ticketFeeWei + _ticketFeeWei / 5,
            0
        );
        _addRuleInternal(
            _packSorted(5, 5, 2),
            5,
            5,
            2,
            _ticketFeeWei + _ticketFeeWei / 5,
            0
        );
        _addRuleInternal(
            _packSorted(4, 4, 4),
            4,
            4,
            4,
            _ticketFeeWei + _ticketFeeWei / 10,
            0
        );

        // Loss: {5,4,3} pays 0 ether (implicitly loss). Keep explicit for clarity.
        _addRuleInternal(_packSorted(5, 4, 3), 5, 4, 3, 0, 0);
    }

    // ============ Admin ============

    function setTicketFeeWei(uint256 newFee) external onlyOwner {
        emit TicketFeeUpdated(ticketFeeWei, newFee);
        ticketFeeWei = newFee;
    }

    function setMaxTicketRate(uint32 newMax) external onlyOwner {
        require(newMax > 0, "MAX_RATE_ZERO");
        maxTicketRate = newMax;
    }

    function setVRFConfig(
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint16 _requestConfirmations,
        uint32 _callbackGasLimit
    ) external onlyOwner {
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        requestConfirmations = _requestConfirmations;
        callbackGasLimit = _callbackGasLimit;
        emit VRFConfigUpdated(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit
        );
    }

    function setUseNativePayment(bool nativePayment) external onlyOwner {
        useNativePayment = nativePayment;
    }

    function setJackpotContributionRate(uint256 newRate) external onlyOwner {
        require(newRate <= MAX_CONTRIBUTION_RATE, "RATE_TOO_HIGH");
        jackpotContributionRate = newRate;
        emit JackpotConfigUpdated(newRate);
    }

    function withdrawFunds(
        address payable to,
        uint256 amount
    ) external onlyOwner {
        if (amount == type(uint256).max) {
            amount = address(this).balance - jackpotPool; // Can only withdraw non-jackpot funds
        }
        require(
            amount <= address(this).balance - jackpotPool,
            "INSUFFICIENT_NON_JACKPOT_BAL"
        );
        require(amount <= address(this).balance, "INSUFFICIENT_BAL");
        (bool success, ) = to.call{value: amount}("");
        require(success, "TRANSFER_FAILED");
        emit FundsWithdrawn(to, amount);
    }

    /**
     * @notice Deposit function for the project to fund the contract
     * Can be called by anyone to deposit funds into the contract
     * These funds will be used for payouts and jackpot pool
     */
    function deposit() external payable {
        require(msg.value > 0, "DEPOSIT_ZERO");
        // Funds are automatically added to contract balance
        // Event is emitted to track deposits
        emit Deposited(msg.sender, msg.value);
    }

    // Jackpot funds can only be won through gameplay, not withdrawn

    /**
     * @notice Receive function that starts a game round with ticketRate=100
     * Only accepts exactly ticketFeeWei to start a single game
     * This is the entry point for ERC-7715 compatibility since we cannot pass arbitrary calldata
     */
    receive() external payable {
        require(msg.value == ticketFeeWei, "INVALID_AMOUNT");
        _play(100); // ticketRate = 100 (1x ticket fee)
    }

    fallback() external payable {}

    // ============ Rule management ============
    // Anyone can add; removal restricted to owner per requirement
    function addRule(
        uint8 a,
        uint8 b,
        uint8 c,
        uint256 payoutWei,
        uint256 jackpotShare
    ) external onlyOwner returns (uint24 key) {
        (uint8 x, uint8 y, uint8 z) = _sort3(a, b, c);
        require(x + y + z == DRAWS, "BAD_SUM");
        require(jackpotShare <= 10000, "JACKPOT_SHARE_TOO_HIGH"); // Max 100%
        key = _packSorted(x, y, z);
        require(!rulesByKey[key].exists, "RULE_EXISTS");
        rulesByKey[key] = Rule({
            exists: true,
            payoutWei: payoutWei,
            jackpotShare: jackpotShare
        });
        emit RuleAdded(key, x, y, z, payoutWei, jackpotShare, msg.sender);
    }

    function modifyRule(
        uint8 a,
        uint8 b,
        uint8 c,
        uint256 payoutWei,
        uint256 jackpotShare
    ) external onlyOwner returns (uint24 key) {
        (uint8 x, uint8 y, uint8 z) = _sort3(a, b, c);
        require(x + y + z == DRAWS, "BAD_SUM");
        require(jackpotShare <= 10000, "JACKPOT_SHARE_TOO_HIGH");
        key = _packSorted(x, y, z);
        require(rulesByKey[key].exists, "RULE_NOT_EXISTS");
        rulesByKey[key] = Rule({
            exists: true,
            payoutWei: payoutWei,
            jackpotShare: jackpotShare
        });
        emit RuleAdded(key, x, y, z, payoutWei, jackpotShare, msg.sender);
    }

    function removeRule(
        uint8 a,
        uint8 b,
        uint8 c
    ) external onlyOwner returns (uint24 key) {
        (uint8 x, uint8 y, uint8 z) = _sort3(a, b, c);
        key = _packSorted(x, y, z);
        require(rulesByKey[key].exists, "NO_RULE");
        delete rulesByKey[key];
        emit RuleRemoved(key, msg.sender);
    }

    // ============ Gameplay ============
    function play(
        uint32 ticketRate
    ) external payable returns (uint256 requestId) {
        return _play(ticketRate);
    }

    function _play(uint32 ticketRate) internal returns (uint256 requestId) {
        require(ticketRate >= 100 && ticketRate <= maxTicketRate, "BAD_RATE");
        require(msg.value == (ticketRate * ticketFeeWei) / 100, "BAD_FEE");
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient
            .RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({
                        nativePayment: useNativePayment
                    })
                )
            });
        requestId = coordinator.requestRandomWords(req);
        requests[requestId] = PlayRequest({
            player: msg.sender,
            paid: msg.value,
            ticketRate: ticketRate
        });
        emit PlayRequested(requestId, msg.sender, msg.value);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PlayRequest memory pr = requests[requestId];
        // If request not found or already settled, ignore
        if (pr.player == address(0)) {
            return;
        }

        // Draw 12 pets without replacement from a pool of 24 (8 per color)
        // Using a single random word expanded via keccak as per provided method
        uint256 random = randomWords[0];
        uint8[3] memory counts; // counts[0]=Red, [1]=Blue, [2]=Yellow
        // Copy pre-initialized pool template from storage to memory
        uint8[24] memory pool = poolTemplate;

        uint8 remaining = 24;
        for (uint8 i = 0; i < DRAWS; i++) {
            uint256 r = uint256(keccak256(abi.encode(random, i)));
            uint8 idx = uint8(r % remaining);
            uint8 color = pool[idx];
            counts[color] += 1;
            pool[idx] = pool[remaining - 1];
            remaining--;
        }

        // Sort counts descending into a,b,c
        (uint8 x, uint8 y, uint8 z) = _sort3(counts[0], counts[1], counts[2]);
        uint24 key = _packSorted(x, y, z);

        uint256 payout = 0;
        uint256 jackpotPayout = 0;
        Rule memory rule = rulesByKey[key];

        if (rule.exists) {
            payout = (pr.ticketRate * rule.payoutWei) / 100;

            // Calculate jackpot distribution
            if (rule.jackpotShare > 0 && jackpotPool > 0) {
                jackpotPayout = (jackpotPool * rule.jackpotShare) / 10000;
                jackpotPool -= jackpotPayout;
                emit JackpotDistributed(jackpotPayout, pr.player);
            }
        }

        // Handle losing tickets - contribute to jackpot
        if (payout == 0 && jackpotPayout == 0) {
            uint256 contribution = (pr.paid * jackpotContributionRate) / 10000;
            jackpotPool += contribution;
            emit JackpotContribution(contribution, jackpotPool);
        }

        // Pay out combined winnings (fixed + jackpot) in a single transfer
        uint256 totalPayout = payout + jackpotPayout;
        if (totalPayout > 0) {
            require(
                address(this).balance >= totalPayout,
                "INSUFFICIENT_CONTRACT_BAL"
            );
            (bool success, ) = payable(pr.player).call{value: totalPayout}("");
            require(success, "PAYOUT_FAILED");
        }

        // persist outcome so frontends can query by requestId (even if they miss the event)
        outcomes[requestId] = PlayOutcome({
            settled: true,
            player: pr.player,
            a: x,
            b: y,
            c: z,
            ticketRate: pr.ticketRate,
            payoutWei: payout,
            jackpotPayout: jackpotPayout,
            timestamp: block.timestamp
        });

        emit PlayResult(
            requestId,
            pr.player,
            x,
            y,
            z,
            pr.ticketRate,
            payout,
            jackpotPayout
        );

        delete requests[requestId];
    }

    /// @notice Get a stored outcome for a given requestId. If `settled` is false, the
    /// request has not been fulfilled yet (or does not exist).
    function getOutcome(
        uint256 requestId
    )
        public
        view
        returns (
            bool settled,
            address player,
            uint8 a,
            uint8 b,
            uint8 c,
            uint32 ticketRate,
            uint256 payoutWei,
            uint256 jackpotPayout,
            uint256 timestamp
        )
    {
        PlayOutcome memory o = outcomes[requestId];
        return (
            o.settled,
            o.player,
            o.a,
            o.b,
            o.c,
            o.ticketRate,
            o.payoutWei,
            o.jackpotPayout,
            o.timestamp
        );
    }

    // ============ Utils ============
    function _addRuleInternal(
        uint24 key,
        uint8 a,
        uint8 b,
        uint8 c,
        uint256 payoutWei,
        uint256 jackpotShare
    ) private {
        rulesByKey[key] = Rule({
            exists: true,
            payoutWei: payoutWei,
            jackpotShare: jackpotShare
        });
        emit RuleAdded(key, a, b, c, payoutWei, jackpotShare, msg.sender);
    }

    function _sort3(
        uint8 x,
        uint8 y,
        uint8 z
    ) private pure returns (uint8 a, uint8 b, uint8 c) {
        a = x;
        b = y;
        c = z;
        if (a < b) {
            (a, b) = (b, a);
        }
        if (a < c) {
            (a, c) = (c, a);
        }
        if (b < c) {
            (b, c) = (c, b);
        }
    }

    function _packSorted(
        uint8 a,
        uint8 b,
        uint8 c
    ) private pure returns (uint24 key) {
        // a,b,c are each <= 12; pack into 3 bytes for a unique key
        key = (uint24(a) << 16) | (uint24(b) << 8) | uint24(c);
    }
}
