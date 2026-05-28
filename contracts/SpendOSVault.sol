// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SpendOSVault
/// @notice MVP Base USDC vault for policy-bound autonomous agent spending.
/// @dev This contract stores policy authority and receipt events. x402 routing and
/// endpoint risk scoring stay offchain, then settle here when a payment is approved.
contract SpendOSVault {
    uint256 private constant SECP256K1_HALF_ORDER =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    struct AgentPolicy {
        address owner;
        uint256 availableBalance;
        uint256 dailyLimit;
        uint256 perTransactionLimit;
        uint256 spentInWindow;
        uint64 windowStart;
        bool paused;
        bytes32 policyDigest;
    }

    IERC20 public immutable usdc;

    mapping(address agentVault => AgentPolicy) public policies;
    mapping(address owner => mapping(address operator => bool allowed)) public operators;

    event AgentRegistered(address indexed owner, address indexed agentVault);
    event AgentFunded(address indexed owner, address indexed agentVault, uint256 amount);
    event AgentWithdrawn(address indexed owner, address indexed agentVault, uint256 amount);
    event OperatorSet(address indexed owner, address indexed operator, bool allowed);
    event PolicyAuthorized(
        address indexed owner,
        address indexed agentVault,
        bytes32 indexed policyDigest,
        uint256 dailyLimit,
        uint256 perTransactionLimit
    );
    event AgentPaused(address indexed owner, address indexed agentVault, bool paused);
    event ReceiptRecorded(
        address indexed agentVault,
        address indexed recipient,
        string service,
        uint256 amount,
        bytes32 indexed receiptHash,
        bytes32 policyDigest
    );

    error InvalidAddress();
    error InvalidAmount();
    error InvalidSignature();
    error NotAgentOwner();
    error NotAuthorizedOperator();
    error AgentPausedError();
    error InsufficientAgentBalance();
    error PerTransactionLimitExceeded();
    error DailyLimitExceeded();
    error TransferFailed();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert InvalidAddress();
        usdc = IERC20(usdcAddress);
    }

    function registerAgent(address agentVault) external {
        if (agentVault == address(0)) revert InvalidAddress();

        AgentPolicy storage policy = policies[agentVault];
        if (policy.owner != address(0)) revert NotAgentOwner();

        policy.owner = msg.sender;
        policy.windowStart = uint64(block.timestamp);

        emit AgentRegistered(msg.sender, agentVault);
    }

    function fundAgent(address agentVault, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();

        AgentPolicy storage policy = _ownerPolicy(agentVault, msg.sender);
        policy.availableBalance += amount;

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        emit AgentFunded(msg.sender, agentVault, amount);
    }

    function withdrawAgent(address agentVault, uint256 amount, address recipient) external {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidAddress();

        AgentPolicy storage policy = _ownerPolicy(agentVault, msg.sender);
        if (policy.availableBalance < amount) revert InsufficientAgentBalance();
        policy.availableBalance -= amount;

        if (!usdc.transfer(recipient, amount)) revert TransferFailed();

        emit AgentWithdrawn(msg.sender, agentVault, amount);
    }

    function setOperator(address operator, bool allowed) external {
        if (operator == address(0)) revert InvalidAddress();
        operators[msg.sender][operator] = allowed;

        emit OperatorSet(msg.sender, operator, allowed);
    }

    function authorizePolicy(
        address agentVault,
        uint256 dailyLimit,
        uint256 perTransactionLimit,
        bytes32 policyDigest,
        bytes calldata ownerSignature
    ) external {
        if (agentVault == address(0)) revert InvalidAddress();
        if (dailyLimit == 0 || perTransactionLimit == 0) revert InvalidAmount();
        if (perTransactionLimit > dailyLimit) revert PerTransactionLimitExceeded();

        bytes32 messageHash = policyMessageHash(agentVault, dailyLimit, perTransactionLimit, policyDigest);
        address signer = recoverSigner(messageHash, ownerSignature);
        if (signer == address(0)) revert InvalidSignature();

        AgentPolicy storage policy = policies[agentVault];
        if (policy.owner == address(0)) {
            policy.owner = signer;
            policy.windowStart = uint64(block.timestamp);
            emit AgentRegistered(signer, agentVault);
        } else if (policy.owner != signer) {
            revert NotAgentOwner();
        }

        policy.dailyLimit = dailyLimit;
        policy.perTransactionLimit = perTransactionLimit;
        policy.policyDigest = policyDigest;

        emit PolicyAuthorized(signer, agentVault, policyDigest, dailyLimit, perTransactionLimit);
    }

    function setPaused(address agentVault, bool paused) external {
        AgentPolicy storage policy = _ownerPolicy(agentVault, msg.sender);
        policy.paused = paused;

        emit AgentPaused(msg.sender, agentVault, paused);
    }

    function spendUSDC(
        address agentVault,
        address recipient,
        uint256 amount,
        string calldata service,
        bytes32 receiptHash
    ) external {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        AgentPolicy storage policy = policies[agentVault];
        if (!_canOperate(policy.owner, msg.sender)) revert NotAuthorizedOperator();
        if (policy.paused) revert AgentPausedError();
        if (amount > policy.perTransactionLimit) revert PerTransactionLimitExceeded();
        if (policy.availableBalance < amount) revert InsufficientAgentBalance();

        _rollWindow(policy);
        if (policy.spentInWindow + amount > policy.dailyLimit) revert DailyLimitExceeded();

        policy.spentInWindow += amount;
        policy.availableBalance -= amount;

        if (!usdc.transfer(recipient, amount)) revert TransferFailed();

        emit ReceiptRecorded(agentVault, recipient, service, amount, receiptHash, policy.policyDigest);
    }

    function policyMessageHash(
        address agentVault,
        uint256 dailyLimit,
        uint256 perTransactionLimit,
        bytes32 policyDigest
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "SpendOS Policy:",
                address(this),
                block.chainid,
                address(usdc),
                agentVault,
                dailyLimit,
                perTransactionLimit,
                policyDigest
            )
        );
    }

    function recoverSigner(bytes32 messageHash, bytes calldata signature) public pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        if (uint256(s) > SECP256K1_HALF_ORDER) revert InvalidSignature();

        return ecrecover(toEthSignedMessageHash(messageHash), v, r, s);
    }

    function toEthSignedMessageHash(bytes32 messageHash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    function _ownerPolicy(address agentVault, address owner) internal view returns (AgentPolicy storage policy) {
        policy = policies[agentVault];
        if (policy.owner != owner) revert NotAgentOwner();
    }

    function _canOperate(address owner, address operator) internal view returns (bool) {
        return owner != address(0) && (operator == owner || operators[owner][operator]);
    }

    function _rollWindow(AgentPolicy storage policy) internal {
        if (block.timestamp >= policy.windowStart + 1 days) {
            policy.windowStart = uint64(block.timestamp);
            policy.spentInWindow = 0;
        }
    }
}
