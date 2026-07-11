#![no_std]

mod access;
mod events;
mod state;
mod storage;
mod types;
mod upgrade;

use soroban_sdk::{contract, contractclient, contractimpl, Address, BytesN, Env, Vec};

use crate::types::{
    ChitError, CircleConfig, CircleState, CircleStatus, Member, Role, Round,
    MAX_CONTRIBUTION_STROOPS, MAX_MEMBERS, MIN_CONTRIBUTION_STROOPS, MIN_MEMBERS, MIN_ROUNDS,
    MIN_ROUND_DURATION_LEDGERS,
};

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn register_circle(env: Env, circle: Address, name: soroban_sdk::Symbol, admin: Address);
    fn update_circle_status(env: Env, circle: Address, status_code: u32);
}

fn status_to_code(status: &CircleStatus) -> u32 {
    match status {
        CircleStatus::Pending => 0,
        CircleStatus::Active => 1,
        CircleStatus::PayoutReady => 2,
        CircleStatus::Completed => 3,
        CircleStatus::Disputed => 4,
        CircleStatus::Cancelled => 5,
    }
}

#[contract]
pub struct ChitChainContract;

#[contractimpl]
impl ChitChainContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        config: CircleConfig,
        registry: Address,
    ) -> Result<(), ChitError> {
        admin.require_auth();

        if env
            .storage()
            .instance()
            .has(&crate::types::DataKey::CircleState)
        {
            return Err(ChitError::AlreadyRegistered);
        }

        if config.contribution_amount < MIN_CONTRIBUTION_STROOPS
            || config.contribution_amount > MAX_CONTRIBUTION_STROOPS
        {
            return Err(ChitError::InvalidContributionAmount);
        }
        if config.max_members < MIN_MEMBERS || config.max_members > MAX_MEMBERS {
            return Err(ChitError::InvalidMemberCount);
        }
        if config.total_rounds < MIN_ROUNDS {
            return Err(ChitError::InvalidMemberCount);
        }
        if config.round_duration_ledgers < MIN_ROUND_DURATION_LEDGERS {
            return Err(ChitError::InvalidRoundDuration);
        }

        let state = CircleState {
            config: config.clone(),
            status: CircleStatus::Pending,
            current_round: 0,
            member_count: 0,
            total_pool: 0,
            admin: admin.clone(),
            created_at_ledger: env.ledger().sequence(),
            registry_contract: registry.clone(),
        };

        storage::set_circle_state(&env, &state);
        storage::set_member_list(&env, &Vec::new(&env));
        storage::set_operator_set(&env, &Vec::new(&env));
        storage::set_contract_version(&env, crate::types::CONTRACT_VERSION);

        events::emit_circle_created(&env, &admin, &config.name, config.max_members);

        let registry_client = RegistryClient::new(&env, &registry);
        registry_client.register_circle(&env.current_contract_address(), &config.name, &admin);
        events::emit_registered_to_registry(&env, &registry);

        Ok(())
    }

    pub fn join_circle(env: Env, member: Address) -> Result<(), ChitError> {
        member.require_auth();

        let state_check = storage::get_circle_state(&env)?;
        if state_check.status != CircleStatus::Pending {
            return Err(ChitError::CircleAlreadyActive);
        }
        if storage::get_member(&env, &member).is_some() {
            return Err(ChitError::AlreadyMember);
        }
        if state_check.member_count >= state_check.config.max_members {
            return Err(ChitError::CircleFull);
        }

        let new_member = Member {
            address: member.clone(),
            joined_at_ledger: env.ledger().sequence(),
            total_deposited: 0,
            rounds_paid: Vec::new(&env),
            has_received_payout: false,
            role: Role::Member,
        };
        storage::set_member(&env, &member, &new_member);

        let mut list = storage::get_member_list(&env);
        list.push_back(member.clone());
        storage::set_member_list(&env, &list);

        let mut state = state_check;
        state.member_count += 1;
        storage::set_circle_state(&env, &state);
        events::emit_member_joined(&env, &member, state.member_count);

        if state.member_count == state.config.max_members {
            let start_ledger = env.ledger().sequence();
            let round = Round {
                round_number: 1,
                start_ledger,
                end_ledger: start_ledger + state.config.round_duration_ledgers,
                pool_amount: 0,
                winner: None,
                payout_tx_hash: None,
                deposits_count: 0,
            };
            storage::set_round(&env, &round);
            state::transition_to_active(&env)?;
            events::emit_circle_activated(&env, state.member_count);
            events::emit_round_started(&env, 1, round.start_ledger, round.end_ledger);

            let registry_client = RegistryClient::new(&env, &state.registry_contract);
            registry_client.update_circle_status(
                &env.current_contract_address(),
                &status_to_code(&CircleStatus::Active),
            );
        }

        Ok(())
    }

    pub fn deposit(env: Env, member: Address) -> Result<(), ChitError> {
        member.require_auth();

        let mut state = storage::get_circle_state(&env)?;
        if state.status != CircleStatus::Active {
            return Err(ChitError::CircleNotActive);
        }

        let mut member_data = storage::get_member(&env, &member).ok_or(ChitError::NotMember)?;
        if member_data.rounds_paid.contains(&state.current_round) {
            return Err(ChitError::AlreadyPaidThisRound);
        }

        let mut round =
            storage::get_round(&env, state.current_round).ok_or(ChitError::RoundNotReady)?;

        let token_client = soroban_sdk::token::Client::new(&env, &state.config.token_address);
        token_client.transfer(
            &member,
            &env.current_contract_address(),
            &state.config.contribution_amount,
        );

        member_data.total_deposited += state.config.contribution_amount;
        member_data.rounds_paid.push_back(state.current_round);
        storage::set_member(&env, &member, &member_data);

        round.pool_amount += state.config.contribution_amount;
        round.deposits_count += 1;
        storage::set_round(&env, &round);

        state.total_pool += state.config.contribution_amount;
        storage::set_circle_state(&env, &state);

        events::emit_deposit(
            &env,
            &member,
            state.config.contribution_amount,
            state.current_round,
            round.pool_amount,
        );

        if round.deposits_count == state.member_count {
            state::transition_to_payout_ready(&env)?;
            events::emit_round_closed(
                &env,
                round.round_number,
                round.deposits_count,
                round.pool_amount,
            );
        }

        Ok(())
    }

    pub fn select_winner(env: Env, caller: Address) -> Result<Address, ChitError> {
        access::require_admin_or_operator(&env, &caller)?;

        let state = storage::get_circle_state(&env)?;
        if state.status != CircleStatus::PayoutReady {
            return Err(ChitError::RoundNotReady);
        }

        let mut round =
            storage::get_round(&env, state.current_round).ok_or(ChitError::RoundNotReady)?;
        if round.winner.is_some() {
            return Err(ChitError::AlreadyPaidThisRound);
        }

        let list = storage::get_member_list(&env);
        let mut candidate: Option<Address> = None;
        for addr in list.iter() {
            let m = storage::get_member(&env, &addr).ok_or(ChitError::NotMember)?;
            if !m.has_received_payout {
                candidate = Some(addr);
                break;
            }
        }
        let winner = candidate.ok_or(ChitError::AllRoundsComplete)?;

        round.winner = Some(winner.clone());
        storage::set_round(&env, &round);

        events::emit_winner_selected(&env, &winner, round.round_number, round.pool_amount);
        Ok(winner)
    }

    pub fn execute_payout(env: Env, caller: Address) -> Result<(), ChitError> {
        access::require_admin_or_operator(&env, &caller)?;

        let mut state = storage::get_circle_state(&env)?;
        if state.status != CircleStatus::PayoutReady {
            return Err(ChitError::RoundNotReady);
        }

        let mut round =
            storage::get_round(&env, state.current_round).ok_or(ChitError::RoundNotReady)?;
        let winner = round.winner.clone().ok_or(ChitError::RoundNotReady)?;

        let token_client = soroban_sdk::token::Client::new(&env, &state.config.token_address);
        token_client.transfer(&env.current_contract_address(), &winner, &round.pool_amount);

        let mut winner_data = storage::get_member(&env, &winner).ok_or(ChitError::NotMember)?;
        winner_data.has_received_payout = true;
        storage::set_member(&env, &winner, &winner_data);

        events::emit_payout(&env, &winner, round.pool_amount, round.round_number);

        state.total_pool -= round.pool_amount;
        storage::set_circle_state(&env, &state);

        round.payout_tx_hash = Some(soroban_sdk::symbol_short!("paid"));
        storage::set_round(&env, &round);

        if state.current_round >= state.config.total_rounds {
            state::transition_to_completed(&env)?;
            let final_state = storage::get_circle_state(&env)?;
            events::emit_circle_completed(
                &env,
                final_state.config.total_rounds,
                final_state.total_pool,
            );

            let registry_client = RegistryClient::new(&env, &final_state.registry_contract);
            registry_client.update_circle_status(
                &env.current_contract_address(),
                &status_to_code(&CircleStatus::Completed),
            );
        } else {
            state::transition_to_active_next_round(&env)?;
            let refreshed = storage::get_circle_state(&env)?;

            let start_ledger = env.ledger().sequence();
            let next_round = Round {
                round_number: refreshed.current_round,
                start_ledger,
                end_ledger: start_ledger + refreshed.config.round_duration_ledgers,
                pool_amount: 0,
                winner: None,
                payout_tx_hash: None,
                deposits_count: 0,
            };
            storage::set_round(&env, &next_round);
            events::emit_round_started(
                &env,
                next_round.round_number,
                next_round.start_ledger,
                next_round.end_ledger,
            );
        }

        Ok(())
    }

    pub fn add_operator(env: Env, admin: Address, operator: Address) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        let mut ops = storage::get_operator_set(&env);
        if !ops.contains(&operator) {
            ops.push_back(operator.clone());
            storage::set_operator_set(&env, &ops);
            events::emit_operator_added(&env, &operator);
        }
        Ok(())
    }

    pub fn remove_operator(env: Env, admin: Address, operator: Address) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        let ops = storage::get_operator_set(&env);
        let mut new_ops = Vec::new(&env);
        for a in ops.iter() {
            if a != operator {
                new_ops.push_back(a);
            }
        }
        storage::set_operator_set(&env, &new_ops);
        events::emit_operator_removed(&env, &operator);
        Ok(())
    }

    pub fn get_operators(env: Env) -> Vec<Address> {
        storage::get_operator_set(&env)
    }

    pub fn emergency_exit(env: Env, admin: Address) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        let state = storage::get_circle_state(&env)?;
        state::transition_to_disputed(&env)?;
        events::emit_emergency_exit(&env, &admin, state.total_pool);
        Ok(())
    }

    pub fn cancel_circle(env: Env, admin: Address) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        state::transition_to_cancelled(&env)?;
        Ok(())
    }

    /// Point this circle at a different registry contract. Admin-only.
    /// Needed because the registry has no upgrade path from its original
    /// deployment — fixing a registry bug means deploying a new registry
    /// instance, and existing circles must be repointed at it via this call
    /// (paired with `upgrade()` to install the code that adds this function).
    pub fn set_registry_contract(env: Env, admin: Address, registry: Address) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        let mut state = storage::get_circle_state(&env)?;
        state.registry_contract = registry;
        storage::set_circle_state(&env, &state);
        Ok(())
    }

    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
        new_version: u32,
    ) -> Result<(), ChitError> {
        access::require_admin(&env, &admin)?;
        upgrade::upgrade_contract(&env, new_wasm_hash, new_version)
    }

    pub fn get_circle_state(env: Env) -> Option<CircleState> {
        storage::get_circle_state(&env).ok()
    }

    pub fn get_member(env: Env, address: Address) -> Option<Member> {
        storage::get_member(&env, &address)
    }

    pub fn get_round(env: Env, round_number: u32) -> Option<Round> {
        storage::get_round(&env, round_number)
    }

    pub fn get_member_list(env: Env) -> Vec<Address> {
        storage::get_member_list(&env)
    }

    pub fn get_version(env: Env) -> u32 {
        upgrade::get_version(&env)
    }
}

#[cfg(test)]
mod tests {
    #[path = "../tests/access_control_test.rs"]
    mod access_control_test;
    #[path = "../tests/deposit_payout_test.rs"]
    mod deposit_payout_test;
    #[path = "../tests/circle_lifecycle_test.rs"]
    mod circle_lifecycle_test;
}
