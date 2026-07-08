use soroban_sdk::{symbol_short, Address, Env, Symbol};

// Every event: topics = (event_name, contract_addr), data = payload
// Frontend subscribes via Stellar RPC getEvents filtering by contract + topic

pub fn emit_circle_created(env: &Env, admin: &Address, name: &Symbol, max_members: u32) {
    env.events().publish(
        (symbol_short!("cr8d"), env.current_contract_address()),
        (admin.clone(), name.clone(), max_members),
    );
}

pub fn emit_member_joined(env: &Env, member: &Address, member_count: u32) {
    env.events().publish(
        (symbol_short!("joined"), env.current_contract_address()),
        (member.clone(), member_count),
    );
}

pub fn emit_circle_activated(env: &Env, member_count: u32) {
    env.events().publish(
        (symbol_short!("active"), env.current_contract_address()),
        member_count,
    );
}

pub fn emit_deposit(env: &Env, member: &Address, amount: i128, round: u32, pool_total: i128) {
    env.events().publish(
        (symbol_short!("deposit"), env.current_contract_address()),
        (member.clone(), amount, round, pool_total),
    );
}

pub fn emit_round_started(env: &Env, round: u32, start_ledger: u32, end_ledger: u32) {
    env.events().publish(
        (symbol_short!("rndst"), env.current_contract_address()),
        (round, start_ledger, end_ledger),
    );
}

pub fn emit_winner_selected(env: &Env, winner: &Address, round: u32, amount: i128) {
    env.events().publish(
        (symbol_short!("winner"), env.current_contract_address()),
        (winner.clone(), round, amount),
    );
}

pub fn emit_payout(env: &Env, recipient: &Address, amount: i128, round: u32) {
    env.events().publish(
        (symbol_short!("payout"), env.current_contract_address()),
        (recipient.clone(), amount, round),
    );
}

pub fn emit_round_closed(env: &Env, round: u32, deposits_count: u32, pool: i128) {
    env.events().publish(
        (symbol_short!("rndcl"), env.current_contract_address()),
        (round, deposits_count, pool),
    );
}

pub fn emit_circle_completed(env: &Env, total_rounds: u32, total_distributed: i128) {
    env.events().publish(
        (symbol_short!("done"), env.current_contract_address()),
        (total_rounds, total_distributed),
    );
}

pub fn emit_emergency_exit(env: &Env, initiator: &Address, refund_amount: i128) {
    env.events().publish(
        (symbol_short!("exit"), env.current_contract_address()),
        (initiator.clone(), refund_amount),
    );
}

pub fn emit_operator_added(env: &Env, operator: &Address) {
    env.events().publish(
        (symbol_short!("opadd"), env.current_contract_address()),
        operator.clone(),
    );
}

pub fn emit_operator_removed(env: &Env, operator: &Address) {
    env.events().publish(
        (symbol_short!("oprem"), env.current_contract_address()),
        operator.clone(),
    );
}

pub fn emit_upgraded(env: &Env, old_version: u32, new_version: u32) {
    env.events().publish(
        (symbol_short!("upg"), env.current_contract_address()),
        (old_version, new_version),
    );
}

pub fn emit_registered_to_registry(env: &Env, registry: &Address) {
    env.events().publish(
        (symbol_short!("reg"), env.current_contract_address()),
        registry.clone(),
    );
}