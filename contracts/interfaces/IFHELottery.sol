// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IFHELottery
 * @notice Interface for the FHELotteryV2 contract
 */
interface IFHELottery {
    // Events
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event GuessSubmitted(uint256 indexed roundId, address indexed player, uint256 guessIndex);
    event RoundSettled(uint256 indexed roundId, uint8 luckyNumber, address[] winners, uint256[] payouts);
    event NoWinnerRound(uint256 indexed roundId, uint8 luckyNumber);
    event RefundClaimed(uint256 indexed roundId, address indexed player, uint256 amount);
    event PlatformFeeCollected(uint256 indexed roundId, uint256 amount);
    event WinnerRevealed(uint256 indexed roundId, address indexed winner, uint8 guess, uint256 payout);
    event DecryptionRequested(uint256 indexed roundId);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    // Core functions
    function submitGuess(externalEuint8 _encryptedGuess, bytes calldata _inputProof) external payable;
    function submitMultipleGuesses(externalEuint8[] calldata _encryptedGuesses, bytes[] calldata _inputProofs) external payable;
    function requestSettlement(uint256 _roundId) external;
    function finalizeSettlement(uint256 _roundId, uint8 _luckyNumber, uint8[] calldata _distances, bytes calldata _decryptionProof) external;
    function claimRefund(uint256 _roundId) external;

    // View functions
    function getCurrentRound() external view returns (
        uint256 roundId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalPool,
        uint256 playerCount,
        uint256 guessCount,
        bool isSettled
    );

    function getRoundResults(uint256 _roundId) external view returns (
        bool isSettled,
        bool hasExactMatch,
        uint8 luckyNumber,
        address[] memory winners,
        uint256[] memory payouts
    );

    function getPlayerGuesses(uint256 _roundId, address _player) external view returns (
        uint256[] memory guessIndices,
        uint256 contribution
    );

    function canClaimRefund(uint256 _roundId, address _player) external view returns (bool);
    function getTimeRemaining() external view returns (uint256);
    function canStartNewRound() external view returns (bool);

    // Admin functions
    function forceNewRound() external;
    function skipStuckRound() external;
    function setPlatformWallet(address _newWallet) external;
    function emergencyWithdraw() external;
    function transferOwnership(address _newOwner) external;
    function acceptOwnership() external;

    // Constants
    function ENTRY_FEE() external view returns (uint256);
    function ROUND_DURATION() external view returns (uint256);
    function COOLING_PERIOD() external view returns (uint256);
    function MAX_PLAYERS() external view returns (uint256);
    function MAX_NUMBER() external view returns (uint256);
    function PLATFORM_FEE_BPS() external view returns (uint256);
    function FINALITY_DELAY() external view returns (uint256);
}
