use soroban_sdk::{Address, Env, Vec};

use crate::types::{
    ChitError, CircleState, DataKey, Member, Round, INSTANCE_BUMP, INSTANCE_LIFETIME_THRESHOLD,
    STORAGE_BUMP_AMOUNT, STORAGE_LIFETIME_THRESHOLD,
};

// ─── Instance Storage (contract lifetime) ─────────────────────────────────────

pub fn get_circle_state(env: &Env) -> Result<CircleState, ChitError> {
    env.storage()
        .instance()
        .get::<DataKey, CircleState>(&DataKey::CircleState)
        .ok_or(ChitError::InvalidState)
}

pub fn set_circle_state(env: &Env, state: &CircleState) {
    env.storage()
        .instance()
        .set(&DataKey::CircleState, state);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP);
}

pub fn get_contract_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::ContractVersion)
        .unwrap_or(1)
}

pub fn set_contract_version(env: &Env, version: u32) {
    env.storage()
        .instance()
        .set(&DataKey::ContractVersion, &version);
}

// ─── Persistent Storage (member + round data) ─────────────────────────────────

pub fn get_member(env: &Env, address: &Address) -> Option<Member> {
    let key = DataKey::Member(address.clone());
    let result = env
        .storage()
        .persistent()
        .get::<DataKey, Member>(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
    }
    result
}

pub fn set_member(env: &Env, address: &Address, member: &Member) {
    let key = DataKey::Member(address.clone());
    env.storage().persistent().set(&key, member);
    env.storage()
        .persistent()
        .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
}

pub fn get_member_list(env: &Env) -> Vec<Address> {
    let key = DataKey::MemberList;
    let result = env
        .storage()
        .persistent()
        .get::<DataKey, Vec<Address>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    if !result.is_empty() {
        env.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
    }
    result
}

pub fn set_member_list(env: &Env, list: &Vec<Address>) {
    let key = DataKey::MemberList;
    env.storage().persistent().set(&key, list);
    env.storage()
        .persistent()
        .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
}

pub fn get_round(env: &Env, round_number: u32) -> Option<Round> {
    let key = DataKey::Round(round_number);
    let result = env
        .storage()
        .persistent()
        .get::<DataKey, Round>(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
    }
    result
}

pub fn set_round(env: &Env, round: &Round) {
    let key = DataKey::Round(round.round_number);
    env.storage().persistent().set(&key, round);
    env.storage()
        .persistent()
        .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
}

pub fn get_winner_queue(env: &Env) -> Vec<Address> {
    let key = DataKey::WinnerQueue;
    let result = env
        .storage()
        .persistent()
        .get::<DataKey, Vec<Address>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    if !result.is_empty() {
        env.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
    }
    result
}

pub fn set_winner_queue(env: &Env, queue: &Vec<Address>) {
    let key = DataKey::WinnerQueue;
    env.storage().persistent().set(&key, queue);
    env.storage()
        .persistent()
        .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
}

// ─── Operator Set (persistent) ─────────────────────────────────────────────────

pub fn get_operator_set(env: &Env) -> Vec<Address> {
    let key = DataKey::OperatorSet;
    let result = env
        .storage()
        .persistent()
        .get::<DataKey, Vec<Address>>(&key)
        .unwrap_or_else(|| Vec::new(env));
    if !result.is_empty() {
        env.storage()
            .persistent()
            .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
    }
    result
}

pub fn set_operator_set(env: &Env, operators: &Vec<Address>) {
    let key = DataKey::OperatorSet;
    env.storage().persistent().set(&key, operators);
    env.storage()
        .persistent()
        .extend_ttl(&key, STORAGE_LIFETIME_THRESHOLD, STORAGE_BUMP_AMOUNT);
}
