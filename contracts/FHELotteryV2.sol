// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { FHE, euint8, externalEuint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHELotteryV2
 * @notice A private-by-default lottery using Zama's fully homomorphic encryption.
 * @dev Updated to use @fhevm/solidity API per Zama documentation.
 *      All guesses and the winning number remain encrypted until settlement.
 */
contract FHELotteryV2 is ZamaEthereumConfig {
    // ============ Constants ============
    uint256 public constant ENTRY_FEE = 0.001 ether;
    uint256 public constant ROUND_DURATION = 10 minutes;
    uint256 public constant COOLING_PERIOD = 10 minutes;
    uint256 public constant MAX_PLAYERS = 60;
    uint256 public constant MAX_NUMBER = 100;
    uint256 public constant PLATFORM_FEE_BPS = 30; // 0.3% = 30 basis points
    uint256 public constant FINALITY_DELAY = 2 minutes; // Delay for block finality

    // ============ Structs ============
    struct EncryptedGuess {
        address player;
        euint8 encryptedNumber;
        euint8 distance;
        uint256 submissionOrder;
        bool isWinner;
        uint8 revealedNumber;
    }

    struct Round {
        uint256 roundId;
        uint256 startTime;
        uint256 endTime;
        euint8 encryptedLuckyNumber;
        uint8 revealedLuckyNumber;
        uint256 totalPool;
        uint256 platformFee;
        uint256 playerCount;
        uint256 guessCount;
        uint256 maxWinners;
        bool isSettled;
        bool luckyNumberRevealed;
        bool hasExactMatch;
        uint256 decryptionRequestedAt; // Timestamp when decryption was requested
        address[] winners;
        uint256[] winnerPayouts;
    }

    // ============ State Variables ============
    address public owner;
    address public pendingOwner;
    address public platformWallet;
    uint256 public currentRoundId;
    
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => EncryptedGuess[]) public roundGuesses;
    mapping(uint256 => mapping(address => uint256[])) public playerGuessIndices;
    mapping(uint256 => mapping(address => bool)) public hasClaimedRefund;
    mapping(uint256 => mapping(address => uint256)) public playerContributions;

    // ============ Events ============
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event GuessSubmitted(uint256 indexed roundId, address indexed player, uint256 guessIndex);
    event RoundSettled(uint256 indexed roundId, uint8 luckyNumber, address[] winners, uint256[] payouts);
    event NoWinnerRound(uint256 indexed roundId, uint8 luckyNumber);
    event RefundClaimed(uint256 indexed roundId, address indexed player, uint256 amount);
    event PlatformFeeCollected(uint256 indexed roundId, uint256 amount);
    event WinnerRevealed(uint256 indexed roundId, address indexed winner, uint8 guess, uint256 payout);
    event DecryptionRequested(uint256 indexed roundId);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier roundActive() {
        Round storage round = rounds[currentRoundId];
        require(block.timestamp >= round.startTime, "Round not started");
        require(block.timestamp < round.endTime, "Round ended");
        require(round.playerCount < MAX_PLAYERS, "Round full");
        _;
    }

    modifier roundEnded(uint256 _roundId) {
        require(block.timestamp >= rounds[_roundId].endTime, "Round not ended");
        _;
    }

    // ============ Constructor ============
    constructor(address _platformWallet) {
        owner = msg.sender;
        platformWallet = _platformWallet;
        _startNewRound();
    }

    // ============ Core Functions ============

    /**
     * @notice Submit an encrypted guess for the current round
     * @param _encryptedGuess The FHE-encrypted guess (0-100)
     * @param _inputProof Proof for the encrypted input
     */
    function submitGuess(
        externalEuint8 _encryptedGuess,
        bytes calldata _inputProof
    ) external payable roundActive {
        require(msg.value >= ENTRY_FEE, "Insufficient fee");
        
        Round storage round = rounds[currentRoundId];
        
        // Convert external input to encrypted uint8 using new API
        euint8 encryptedNumber = FHE.fromExternal(_encryptedGuess, _inputProof);
        
        // Validate guess is within range (0-100) using encrypted comparison
        // Use scalar operand for gas optimization per Zama best practices
        ebool isValidHigh = FHE.le(encryptedNumber, uint8(MAX_NUMBER));
        
        // Clamp to valid range (conditional select based on validity)
        euint8 clampedGuess = FHE.select(
            isValidHigh,
            encryptedNumber,
            FHE.asEuint8(0) // FHE.select requires encrypted operands
        );
        
        // Store the encrypted guess
        uint256 guessIndex = round.guessCount;
        roundGuesses[currentRoundId].push(EncryptedGuess({
            player: msg.sender,
            encryptedNumber: clampedGuess,
            distance: FHE.asEuint8(255), // placeholder distance (max uint8)
            submissionOrder: guessIndex,
            isWinner: false,
            revealedNumber: 0
        }));
        
        playerGuessIndices[currentRoundId][msg.sender].push(guessIndex);
        
        // Track if this is a new player
        if (playerGuessIndices[currentRoundId][msg.sender].length == 1) {
            round.playerCount++;
        }
        
        round.guessCount++;
        round.totalPool += msg.value;
        playerContributions[currentRoundId][msg.sender] += msg.value;
        
        // Grant FHE permissions per Zama docs
        FHE.allowThis(clampedGuess);
        FHE.allow(clampedGuess, msg.sender);
        
        emit GuessSubmitted(currentRoundId, msg.sender, guessIndex);
        
        // Refund excess ETH
        if (msg.value > ENTRY_FEE) {
            uint256 refund = msg.value - ENTRY_FEE;
            round.totalPool -= refund;
            playerContributions[currentRoundId][msg.sender] -= refund;
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Submit multiple encrypted guesses in one transaction
     * @param _encryptedGuesses Array of encrypted guesses
     * @param _inputProofs Array of proofs
     */
    function submitMultipleGuesses(
        externalEuint8[] calldata _encryptedGuesses,
        bytes[] calldata _inputProofs
    ) external payable roundActive {
        uint256 numGuesses = _encryptedGuesses.length;
        require(numGuesses > 0 && numGuesses <= 10, "Invalid guess count");
        require(_inputProofs.length == numGuesses, "Proof count mismatch");
        require(msg.value >= ENTRY_FEE * numGuesses, "Insufficient fee");
        
        Round storage round = rounds[currentRoundId];
        
        for (uint256 i = 0; i < numGuesses; i++) {
            euint8 encryptedNumber = FHE.fromExternal(_encryptedGuesses[i], _inputProofs[i]);
            
            // Use scalar operand for gas optimization per Zama best practices
            ebool isValidHigh = FHE.le(encryptedNumber, uint8(MAX_NUMBER));
            
            euint8 clampedGuess = FHE.select(
                isValidHigh,
                encryptedNumber,
                FHE.asEuint8(0)
            );
            
            uint256 guessIndex = round.guessCount;
            roundGuesses[currentRoundId].push(EncryptedGuess({
                player: msg.sender,
                encryptedNumber: clampedGuess,
                distance: FHE.asEuint8(255), // placeholder distance (max uint8)
                submissionOrder: guessIndex,
                isWinner: false,
                revealedNumber: 0
            }));
            
            playerGuessIndices[currentRoundId][msg.sender].push(guessIndex);
            round.guessCount++;
            
            FHE.allowThis(clampedGuess);
            FHE.allow(clampedGuess, msg.sender);
            
            emit GuessSubmitted(currentRoundId, msg.sender, guessIndex);
        }
        
        if (playerGuessIndices[currentRoundId][msg.sender].length == numGuesses) {
            round.playerCount++;
        }
        
        uint256 totalFee = ENTRY_FEE * numGuesses;
        round.totalPool += totalFee;
        playerContributions[currentRoundId][msg.sender] += totalFee;
        
        // Refund excess
        if (msg.value > totalFee) {
            (bool success, ) = msg.sender.call{value: msg.value - totalFee}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Request public decryption for settlement
     * @param _roundId The round to settle
     */
    function requestSettlement(uint256 _roundId) external roundEnded(_roundId) {
        Round storage round = rounds[_roundId];
        require(!round.isSettled, "Already settled");
        require(round.guessCount > 0, "No guesses");
        
        // Calculate platform fee
        round.platformFee = (round.totalPool * PLATFORM_FEE_BPS) / 10000;
        round.maxWinners = _calculateMaxWinners(round.playerCount);
        
        // Compute distances for all guesses (encrypted)
        _computeDistances(_roundId);
        
        // Mark lucky number as publicly decryptable per Zama docs
        FHE.makePubliclyDecryptable(round.encryptedLuckyNumber);
        
        // Mark all distances as publicly decryptable
        EncryptedGuess[] storage guesses = roundGuesses[_roundId];
        for (uint256 i = 0; i < guesses.length; i++) {
            FHE.makePubliclyDecryptable(guesses[i].distance);
        }
        
        // Record timestamp for finality delay (per FHEVM security guide)
        round.decryptionRequestedAt = block.timestamp;
        
        emit DecryptionRequested(_roundId);
    }

    /**
     * @notice Finalize settlement with decrypted values and proof
     * @param _roundId The round to settle
     * @param _luckyNumber The decrypted lucky number
     * @param _distances Array of decrypted distances
     * @param _decryptionProof Proof from Zama KMS
     */
    function finalizeSettlement(
        uint256 _roundId,
        uint8 _luckyNumber,
        uint8[] calldata _distances,
        bytes calldata _decryptionProof
    ) external {
        Round storage round = rounds[_roundId];
        require(!round.isSettled, "Already settled");
        
        // Security: Enforce finality delay to prevent block reorg attacks (per FHEVM guide)
        require(round.decryptionRequestedAt > 0, "Decryption not requested");
        require(
            block.timestamp >= round.decryptionRequestedAt + FINALITY_DELAY,
            "Finality delay not passed"
        );
        
        // Security: Mark as settled BEFORE external calls (CEI pattern / replay prevention)
        round.isSettled = true;
        
        EncryptedGuess[] storage guesses = roundGuesses[_roundId];
        require(_distances.length == guesses.length, "Distance count mismatch");
        
        // Build ciphertext handles array for verification
        bytes32[] memory ciphertexts = new bytes32[](1 + guesses.length);
        ciphertexts[0] = FHE.toBytes32(round.encryptedLuckyNumber);
        for (uint256 i = 0; i < guesses.length; i++) {
            ciphertexts[i + 1] = FHE.toBytes32(guesses[i].distance);
        }
        
        // Build cleartext bytes for verification per Zama docs
        // Each cleartext must be individually abi.encode'd and concatenated
        // Order must match ciphertexts array: [luckyNumber, distances[0], distances[1], ...]
        bytes memory cleartexts = abi.encode(_luckyNumber);
        for (uint256 i = 0; i < _distances.length; i++) {
            cleartexts = bytes.concat(cleartexts, abi.encode(_distances[i]));
        }
        
        // Verify decryption proof per Zama docs
        FHE.checkSignatures(ciphertexts, cleartexts, _decryptionProof);
        
        // Store revealed lucky number
        round.revealedLuckyNumber = _luckyNumber;
        round.luckyNumberRevealed = true;
        
        // Process winners
        _processWinners(_roundId, _distances);
    }

    /**
     * @notice Process winners after decryption verification
     */
    function _processWinners(uint256 _roundId, uint8[] calldata _distances) internal {
        Round storage round = rounds[_roundId];
        EncryptedGuess[] storage guesses = roundGuesses[_roundId];
        
        // Check for exact matches (distance = 0)
        bool hasExact = false;
        for (uint256 i = 0; i < _distances.length; i++) {
            if (_distances[i] == 0) {
                hasExact = true;
                break;
            }
        }
        
        round.hasExactMatch = hasExact;
        
        if (!hasExact) {
            // No winner round - isSettled already set in finalizeSettlement (CEI pattern)
            
            // Transfer platform fee
            if (round.platformFee > 0) {
                (bool success, ) = platformWallet.call{value: round.platformFee}("");
                require(success, "Platform fee transfer failed");
                emit PlatformFeeCollected(_roundId, round.platformFee);
            }
            
            emit NoWinnerRound(_roundId, round.revealedLuckyNumber);
            _startNewRound();
            return;
        }
        
        // Sort indices by distance
        uint256[] memory sortedIndices = new uint256[](_distances.length);
        for (uint256 i = 0; i < _distances.length; i++) {
            sortedIndices[i] = i;
        }
        
        // Bubble sort by distance
        for (uint256 i = 0; i < _distances.length - 1; i++) {
            for (uint256 j = 0; j < _distances.length - i - 1; j++) {
                uint8 dist1 = _distances[sortedIndices[j]];
                uint8 dist2 = _distances[sortedIndices[j + 1]];
                
                bool shouldSwap = dist1 > dist2;
                if (dist1 == dist2) {
                    shouldSwap = guesses[sortedIndices[j]].submissionOrder > 
                                guesses[sortedIndices[j + 1]].submissionOrder;
                }
                
                if (shouldSwap) {
                    uint256 temp = sortedIndices[j];
                    sortedIndices[j] = sortedIndices[j + 1];
                    sortedIndices[j + 1] = temp;
                }
            }
        }
        
        // Select winners and distribute payouts
        uint256 winnerCount = 0;
        uint256 prizePool = round.totalPool - round.platformFee;
        uint256[] memory payoutShares = _calculatePayoutShares(round.maxWinners);
        
        for (uint256 i = 0; i < sortedIndices.length && winnerCount < round.maxWinners; i++) {
            uint256 idx = sortedIndices[i];
            address winner = guesses[idx].player;
            
            // Check if this player is already a winner
            bool alreadyWinner = false;
            for (uint256 j = 0; j < round.winners.length; j++) {
                if (round.winners[j] == winner) {
                    alreadyWinner = true;
                    break;
                }
            }
            
            if (!alreadyWinner) {
                guesses[idx].isWinner = true;
                
                uint256 payout = (prizePool * payoutShares[winnerCount]) / 10000;
                round.winners.push(winner);
                round.winnerPayouts.push(payout);
                
                // Transfer payout
                (bool success, ) = winner.call{value: payout}("");
                require(success, "Payout failed");
                
                emit WinnerRevealed(_roundId, winner, _distances[idx] == 0 ? 
                    round.revealedLuckyNumber : 0, payout);
                
                winnerCount++;
            }
        }
        
        // Transfer platform fee
        if (round.platformFee > 0) {
            (bool success, ) = platformWallet.call{value: round.platformFee}("");
            require(success, "Platform fee transfer failed");
            emit PlatformFeeCollected(_roundId, round.platformFee);
        }
        
        // round.isSettled already set at function start (CEI pattern)
        
        emit RoundSettled(_roundId, round.revealedLuckyNumber, round.winners, round.winnerPayouts);
        
        _startNewRound();
    }

    /**
     * @notice Claim refund for a no-winner round
     * @param _roundId The round to claim from
     */
    function claimRefund(uint256 _roundId) external {
        Round storage round = rounds[_roundId];
        require(round.isSettled, "Not settled");
        require(!round.hasExactMatch, "Round has winners");
        require(!hasClaimedRefund[_roundId][msg.sender], "Already claimed");
        require(playerContributions[_roundId][msg.sender] > 0, "No contribution");
        
        hasClaimedRefund[_roundId][msg.sender] = true;
        
        uint256 contribution = playerContributions[_roundId][msg.sender];
        uint256 playerFeeShare = (contribution * PLATFORM_FEE_BPS) / 10000;
        uint256 refundAmount = contribution - playerFeeShare;
        
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund transfer failed");
        
        emit RefundClaimed(_roundId, msg.sender, refundAmount);
    }

    // ============ Internal Functions ============

    /**
     * @notice Start a new lottery round
     */
    function _startNewRound() internal {
        currentRoundId++;
        
        uint256 startTime = block.timestamp;
        if (currentRoundId > 1) {
            Round storage prevRound = rounds[currentRoundId - 1];
            uint256 scheduledStart = prevRound.endTime + COOLING_PERIOD;
            // Use the later of current time or scheduled start to handle skipped/stuck rounds
            startTime = scheduledStart > block.timestamp ? scheduledStart : block.timestamp;
        }
        
        // Generate encrypted random lucky number (0-100)
        // Use bounded random per Zama docs: upperBound must be power of 2
        // randEuint8(128) returns 0-127, then clamp 101-127 down to range
        euint8 randomValue = FHE.randEuint8(128);
        
        // Clamp values 101-127 to valid range using scalar operands (gas optimization)
        ebool tooHigh = FHE.gt(randomValue, uint8(MAX_NUMBER));
        euint8 adjusted = FHE.sub(randomValue, 101);
        euint8 luckyNumber = FHE.select(tooHigh, adjusted, randomValue);
        // Values 101-127 become 0-26 after subtraction, always valid
        
        // Grant FHE permissions per Zama docs
        FHE.allowThis(luckyNumber);
        
        rounds[currentRoundId] = Round({
            roundId: currentRoundId,
            startTime: startTime,
            endTime: startTime + ROUND_DURATION,
            encryptedLuckyNumber: luckyNumber,
            revealedLuckyNumber: 0,
            totalPool: 0,
            platformFee: 0,
            playerCount: 0,
            guessCount: 0,
            maxWinners: 1,
            isSettled: false,
            luckyNumberRevealed: false,
            hasExactMatch: false,
            decryptionRequestedAt: 0,
            winners: new address[](0),
            winnerPayouts: new uint256[](0)
        });
        
        emit RoundStarted(currentRoundId, startTime, startTime + ROUND_DURATION);
    }

    /**
     * @notice Calculate max winners based on player count
     */
    function _calculateMaxWinners(uint256 _playerCount) internal pure returns (uint256) {
        if (_playerCount <= 10) return 1;
        if (_playerCount <= 20) return 3;
        if (_playerCount <= 30) return 5;
        if (_playerCount <= 40) return 7;
        if (_playerCount <= 50) return 9;
        return 11;
    }

    /**
     * @notice Compute encrypted distances for all guesses
     */
    function _computeDistances(uint256 _roundId) internal {
        Round storage round = rounds[_roundId];
        EncryptedGuess[] storage guesses = roundGuesses[_roundId];
        
        // Verify lucky number is properly initialized per Zama docs
        require(FHE.isInitialized(round.encryptedLuckyNumber), "Lucky number not initialized");
        
        for (uint256 i = 0; i < guesses.length; i++) {
            euint8 guess = guesses[i].encryptedNumber;
            euint8 lucky = round.encryptedLuckyNumber;
            
            // Compute absolute distance: |guess - luckyNumber|
            ebool guessGreater = FHE.gt(guess, lucky);
            euint8 diff1 = FHE.sub(guess, lucky);
            euint8 diff2 = FHE.sub(lucky, guess);
            
            euint8 distance = FHE.select(guessGreater, diff1, diff2);
            guesses[i].distance = distance;
            
            // Grant FHE permissions per Zama docs
            FHE.allowThis(distance);
            FHE.allow(distance, guesses[i].player);
        }
    }

    /**
     * @notice Calculate payout shares for winners
     */
    function _calculatePayoutShares(uint256 _winnerCount) internal pure returns (uint256[] memory) {
        uint256[] memory shares = new uint256[](_winnerCount);
        
        if (_winnerCount == 1) {
            shares[0] = 10000;
        } else if (_winnerCount == 3) {
            shares[0] = 5000;
            shares[1] = 3000;
            shares[2] = 2000;
        } else if (_winnerCount == 5) {
            shares[0] = 3500;
            shares[1] = 2500;
            shares[2] = 2000;
            shares[3] = 1200;
            shares[4] = 800;
        } else if (_winnerCount == 7) {
            shares[0] = 3000;
            shares[1] = 2000;
            shares[2] = 1700;
            shares[3] = 1300;
            shares[4] = 1000;
            shares[5] = 600;
            shares[6] = 400;
        } else if (_winnerCount == 9) {
            shares[0] = 2500;
            shares[1] = 1800;
            shares[2] = 1400;
            shares[3] = 1200;
            shares[4] = 1000;
            shares[5] = 800;
            shares[6] = 600;
            shares[7] = 400;
            shares[8] = 300;
        } else {
            shares[0] = 2200;
            shares[1] = 1600;
            shares[2] = 1300;
            shares[3] = 1100;
            shares[4] = 900;
            shares[5] = 800;
            shares[6] = 700;
            shares[7] = 550;
            shares[8] = 400;
            shares[9] = 300;
            shares[10] = 150;
        }
        
        return shares;
    }

    // ============ View Functions ============

    function getCurrentRound() external view returns (
        uint256 roundId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalPool,
        uint256 playerCount,
        uint256 guessCount,
        bool isSettled
    ) {
        Round storage round = rounds[currentRoundId];
        return (
            round.roundId,
            round.startTime,
            round.endTime,
            round.totalPool,
            round.playerCount,
            round.guessCount,
            round.isSettled
        );
    }

    function getRoundResults(uint256 _roundId) external view returns (
        bool isSettled,
        bool hasExactMatch,
        uint8 luckyNumber,
        address[] memory winners,
        uint256[] memory payouts
    ) {
        Round storage round = rounds[_roundId];
        require(round.isSettled, "Not settled yet");
        
        return (
            round.isSettled,
            round.hasExactMatch,
            round.revealedLuckyNumber,
            round.winners,
            round.winnerPayouts
        );
    }

    function getPlayerGuesses(uint256 _roundId, address _player) external view returns (
        uint256[] memory guessIndices,
        uint256 contribution
    ) {
        return (
            playerGuessIndices[_roundId][_player],
            playerContributions[_roundId][_player]
        );
    }

    function canClaimRefund(uint256 _roundId, address _player) external view returns (bool) {
        Round storage round = rounds[_roundId];
        return round.isSettled && 
               !round.hasExactMatch && 
               !hasClaimedRefund[_roundId][_player] &&
               playerContributions[_roundId][_player] > 0;
    }

    function getTimeRemaining() external view returns (uint256) {
        Round storage round = rounds[currentRoundId];
        if (block.timestamp >= round.endTime) return 0;
        return round.endTime - block.timestamp;
    }

    function canStartNewRound() external view returns (bool) {
        if (currentRoundId == 0) return true;
        Round storage round = rounds[currentRoundId];
        return round.isSettled && block.timestamp >= round.endTime + COOLING_PERIOD;
    }

    // ============ Admin Functions ============

    function forceNewRound() external onlyOwner {
        require(rounds[currentRoundId].isSettled, "Current round not settled");
        _startNewRound();
    }

    /**
     * @notice Skip a stuck round and start fresh (for rounds that ended without settlement)
     * @dev Refunds are still available for players in the skipped round
     */
    function skipStuckRound() external onlyOwner {
        Round storage round = rounds[currentRoundId];
        require(block.timestamp >= round.endTime, "Round not ended yet");
        require(!round.isSettled, "Round already settled");
        
        // Mark as settled with no winners (allows refunds)
        round.isSettled = true;
        round.hasExactMatch = false;
        
        // Calculate and transfer platform fee so claimRefund math is consistent
        if (round.totalPool > 0) {
            round.platformFee = (round.totalPool * PLATFORM_FEE_BPS) / 10000;
            if (round.platformFee > 0) {
                (bool success, ) = platformWallet.call{value: round.platformFee}("");
                require(success, "Platform fee transfer failed");
                emit PlatformFeeCollected(currentRoundId, round.platformFee);
            }
        }
        
        // Start new round immediately
        _startNewRound();
    }

    function setPlatformWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid address");
        platformWallet = _newWallet;
    }

    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        pendingOwner = _newOwner;
        emit OwnershipTransferStarted(owner, _newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    receive() external payable {}
}
