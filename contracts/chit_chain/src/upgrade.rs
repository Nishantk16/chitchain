use soroban_sdk::{contracttype, BytesN, Env};

use crate::{
    events::emit_upgraded,
    storage::{get_contract_version, set_contract_version},
    types::{ChitError, CONTRACT_VERSION},
};

#[contracttype]
pub struct UpgradeProposal {
    pub new_wasm_hash: BytesN<32>,
    pub proposed_at_ledger: u32,
    pub new_version: u32,
}

/// Upgrade the contract WASM. Admin-only.
/// Emits an `upg` event for frontend tracking.
/// Version must be strictly greater than current.
pub fn upgrade_contract(
    env: &Env,
    new_wasm_hash: BytesN<32>,
    new_version: u32,
) -> Result<(), ChitError> {
    let current_version = get_contract_version(env);

    if new_version <= current_version {
        return Err(ChitError::InvalidState);
    }

    emit_upgraded(env, current_version, new_version);
    set_contract_version(env, new_version);

    env.deployer().update_current_contract_wasm(new_wasm_hash);

    Ok(())
}

pub fn get_version(env: &Env) -> u32 {
    get_contract_version(env)
}