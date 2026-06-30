use soroban_sdk::{contracttype, symbol_short, Address, Symbol, Vec};

// ─── State Machine ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CircleStatus {
    Pending,      // Created, waiting for members to join
    Active,       // All members joined, rounds in progress
    PayoutReady,  // Round pool collected, winner selected
    Completed,    // All rounds done
    Disputed,     // Emergency exit triggered
    Cancelled,    // Admin cancelled before activation
}

// ─── RBAC Roles ───────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,    // Contract owner, can upgrade + cancel
    Operator, // Can select winner, advance rounds
    Member,   // Can deposit, claim payout
}

// ─── Core Domain Types ────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct CircleConfig {
    pub name: Symbol,
    pub contribution_amount: i128, // XLM in stroops
    pub max_members: u32,
    pub total_rounds: u32,
    pub round_duration_ledgers: u32, // ~5s per ledger on Stellar
    pub token_address: Address,      // XLM SAC or any Stellar Asset Contract
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Member {
    pub address: Address,
    pub joined_at_ledger: u32,
    pub total_deposited: i128,
    pub rounds_paid: Vec<u32>,
    pub has_received_payout: bool,
    pub role: Role,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Round {
    pub round_number: u32,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub pool_amount: i128,
    pub winner: Option<Address>,
    pub payout_tx_hash: Option<Symbol>,
    pub deposits_count: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CircleState {
    pub config: CircleConfig,
    pub status: CircleStatus,
    pub current_round: u32,
    pub member_count: u32,
    pub total_pool: i128,
    pub admin: Address,
    pub created_at_ledger: u32,
    pub registry_contract: Address,
}

// ─── Storage Key Enum ─────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    CircleState,
    Member(Address),
    Round(u32),
    MemberList,
    WinnerQueue,       // Tracks who hasn't received payout yet
    ContractVersion,
    OperatorSet,
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ChitError {
    // Auth errors 1xx
    Unauthorized = 100,
    NotMember = 101,
    AlreadyMember = 102,
    InvalidRole = 103,

    // State errors 2xx
    InvalidState = 200,
    CircleNotActive = 201,
    CircleAlreadyActive = 202,
    CircleCompleted = 203,
    CircleCancelled = 204,

    // Round errors 3xx
    RoundNotReady = 300,
    AlreadyPaidThisRound = 301,
    RoundStillOpen = 302,
    AllRoundsComplete = 303,

    // Config errors 4xx
    InvalidContributionAmount = 400,
    InvalidMemberCount = 401,
    InvalidRoundDuration = 402,
    CircleFull = 403,
    NameTooLong = 404,

    // Fund errors 5xx
    InsufficientFunds = 500,
    PayoutFailed = 501,
    PoolNotReady = 502,

    // Registry errors 6xx
    RegistryCallFailed = 600,
    AlreadyRegistered = 601,
}

impl From<ChitError> for soroban_sdk::Error {
    fn from(e: ChitError) -> Self {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

impl From<&ChitError> for soroban_sdk::Error {
    fn from(e: &ChitError) -> Self {
        soroban_sdk::Error::from_contract_error(*e as u32)
    }
}

impl From<soroban_sdk::Error> for ChitError {
    fn from(_: soroban_sdk::Error) -> Self {
        ChitError::RegistryCallFailed
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────

pub const MIN_CONTRIBUTION_STROOPS: i128 = 10_000_000; // 1 XLM
pub const MAX_CONTRIBUTION_STROOPS: i128 = 100_000_000_000; // 10,000 XLM
pub const MIN_MEMBERS: u32 = 2;
pub const MAX_MEMBERS: u32 = 50;
pub const MIN_ROUNDS: u32 = 1;
pub const MIN_ROUND_DURATION_LEDGERS: u32 = 17_280; // ~24 hours
pub const MAX_NAME_LEN: usize = 32;
pub const CONTRACT_VERSION: u32 = 1;

pub const STORAGE_BUMP_AMOUNT: u32 = 518_400; // ~30 days
pub const STORAGE_LIFETIME_THRESHOLD: u32 = 432_000; // ~25 days
pub const INSTANCE_BUMP: u32 = 518_400;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = 432_000;

pub const EVENT_CIRCLE_CREATED: Symbol = symbol_short!("cr8d");
pub const EVENT_MEMBER_JOINED: Symbol = symbol_short!("joined");
pub const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
pub const EVENT_ROUND_START: Symbol = symbol_short!("rndst");
pub const EVENT_WINNER_SELECTED: Symbol = symbol_short!("winner");
pub const EVENT_PAYOUT: Symbol = symbol_short!("payout");
pub const EVENT_CIRCLE_COMPLETED: Symbol = symbol_short!("done");
pub const EVENT_EMERGENCY_EXIT: Symbol = symbol_short!("exit");
pub const EVENT_UPGRADED: Symbol = symbol_short!("upg");