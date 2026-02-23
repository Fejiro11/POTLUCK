// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFHELottery
 * @notice Interface for the FHE Lottery contract
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

    // Core functions
    function submitGuess(bytes calldata _encryptedGuess, bytes calldata _inputProof) external payable;
    function submitMultipleGuesses(bytes[] calldata _encryptedGuesses, bytes[] calldata _inputProofs) external payable;
    function initiateSettlement(uint256 _roundId) external;
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

    // Constants
    function ENTRY_FEE() external view returns (uint256);
    function ROUND_DURATION() external view returns (uint256);
    function COOLING_PERIOD() external view returns (uint256);
    function MAX_PLAYERS() external view returns (uint256);
    function MAX_NUMBER() external view returns (uint256);
    function PLATFORM_FEE_BPS() external view returns (uint256);
}
