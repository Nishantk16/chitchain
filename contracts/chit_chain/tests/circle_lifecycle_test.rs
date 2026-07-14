use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env,
};
use std::vec::Vec;

use crate::{
    ChitChainContract, ChitChainContractClient,
    types::{CircleConfig, CircleStatus},
};

/// A minimal stand-in Registry contract used only in tests, so that
/// `ChitChainContract` can exercise its real cross-contract call path
/// (via `RegistryClient`) without needing the full `registry` crate as
/// a test dependency. It simply accepts and stores calls; it does not
/// need to replicate the real registry's validation logic.
pub mod mock_registry {
    use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

    #[contracttype]
    pub enum MockKey {
        Calls,
    }

    #[contract]
    pub struct MockRegistry;

    #[contractimpl]
    impl MockRegistry {
        pub fn register_circle(env: Env, _circle: Address, _name: Symbol, _admin: Address) {
            let count: u32 = env
                .storage()
                .instance()
                .get(&MockKey::Calls)
                .unwrap_or(0);
            env.storage().instance().set(&MockKey::Calls, &(count + 1));
        }

        pub fn update_circle_status(env: Env, _circle: Address, _status_code: u32) {
            let count: u32 = env
                .storage()
                .instance()
                .get(&MockKey::Calls)
                .unwrap_or(0);
            env.storage().instance().set(&MockKey::Calls, &(count + 1));
        }

        pub fn call_count(env: Env) -> u32 {
            env.storage().instance().get(&MockKey::Calls).unwrap_or(0)
        }
    }
}

fn setup(env: &Env, n_members: u32) -> (ChitChainContractClient, Vec<Address>, Address, Address) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let token_addr = env.register_stellar_asset_contract(admin.clone());
    let token_admin = StellarAssetClient::new(env, &token_addr);

    let registry = env.register_contract(None, mock_registry::MockRegistry);

    let contract_id = env.register_contract(None, ChitChainContract);
    let client = ChitChainContractClient::new(env, &contract_id);

    let config = CircleConfig {
        name: symbol_short!("Lifecycle"),
        contribution_amount: 10_000_000,
        max_members: n_members,
        total_rounds: n_members,
        round_duration_ledgers: 17_280,
        token_address: token_addr,
    };

    client.initialize(&admin, &config, &registry);

    let members: Vec<Address> = (0..n_members)
        .map(|_| {
            let m = Address::generate(env);
            token_admin.mint(&m, &1_000_000_000);
            m
        })
        .collect();

    (client, members, admin, registry)
}

#[test]
fn test_initialize_notifies_registry() {
    let env = Env::default();
    let (_, _members, _admin, registry) = setup(&env, 3);

    let registry_client = mock_registry::MockRegistryClient::new(&env, &registry);
    assert_eq!(registry_client.call_count(), 1);
}

#[test]
fn test_pending_circle_accepts_members_up_to_max() {
    let env = Env::default();
    let (client, members, _admin, _registry) = setup(&env, 3);

    client.join_circle(&members[0]);
    client.join_circle(&members[1]);

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.status, CircleStatus::Pending);
    assert_eq!(state.member_count, 2);

    client.join_circle(&members[2]);
    let state = client.get_circle_state().unwrap();
    assert_eq!(state.status, CircleStatus::Active);
    assert_eq!(state.member_count, 3);
    assert_eq!(state.current_round, 1);
}

#[test]
fn test_cannot_join_twice() {
    let env = Env::default();
    let (client, members, _admin, _registry) = setup(&env, 3);

    client.join_circle(&members[0]);
    let result = client.try_join_circle(&members[0]);
    assert!(result.is_err());
}

#[test]
fn test_cannot_join_full_circle() {
    let env = Env::default();
    let (client, members, _admin, _registry) = setup(&env, 2);

    client.join_circle(&members[0]);
    client.join_circle(&members[1]);

    let extra = Address::generate(&env);
    let result = client.try_join_circle(&extra);
    assert!(result.is_err());
}

#[test]
fn test_full_circle_lifecycle_end_to_end() {
    let env = Env::default();
    env.ledger().set_sequence_number(1000);

    let n: u32 = 3;
    let (client, members, admin, _registry) = setup(&env, n);

    for m in &members {
        client.join_circle(m);
    }
    assert_eq!(
        client.get_circle_state().unwrap().status,
        CircleStatus::Active
    );

    for round in 1..=n {
        for m in &members {
            client.deposit(m);
        }

        let state = client.get_circle_state().unwrap();
        assert_eq!(state.status, CircleStatus::PayoutReady);
        assert_eq!(state.current_round, round);

        let winner = client.select_winner(&admin);
        assert!(members.contains(&winner));

        client.execute_payout(&admin);

        let winner_data = client.get_member(&winner).unwrap();
        assert!(winner_data.has_received_payout);
    }

    let final_state = client.get_circle_state().unwrap();
    assert_eq!(final_state.status, CircleStatus::Completed);
    assert_eq!(final_state.total_pool, 0);
}
