#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

use crate::{
    ChitChainContract, ChitChainContractClient,
    types::{CircleConfig, CircleStatus},
};

fn setup_active_circle(env: &Env, n_members: u32) -> (ChitChainContractClient, Vec<Address>, Address) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let token_addr = env.register_stellar_asset_contract(admin.clone());
    let token_admin = StellarAssetClient::new(env, &token_addr);

    let registry = env.register_contract(
        None,
        crate::tests::circle_lifecycle_test::mock_registry::MockRegistry,
    );

    let contract_id = env.register_contract(None, ChitChainContract);
    let client = ChitChainContractClient::new(env, &contract_id);

    let config = CircleConfig {
        name: symbol_short!("SavCirc"),
        contribution_amount: 10_000_000,
        max_members: n_members,
        total_rounds: n_members,
        round_duration_ledgers: 17_280,
        token_address: token_addr.clone(),
    };

    client.initialize(&admin, &config, &registry);

    let members: Vec<Address> = (0..n_members)
        .map(|_| {
            let m = Address::generate(env);
            token_admin.mint(&m, &100_000_000_0);
            m
        })
        .collect();

    for m in &members {
        client.join_circle(m);
    }

    assert_eq!(client.get_circle_state().unwrap().status, CircleStatus::Active);

    (client, members, admin)
}

#[test]
fn test_members_can_deposit() {
    let env = Env::default();
    let (client, members, _admin) = setup_active_circle(&env, 3);

    client.deposit(&members[0]);
    client.deposit(&members[1]);

    let round = client.get_round(&1).unwrap();
    assert_eq!(round.deposits_count, 2);
    assert_eq!(round.pool_amount, 20_000_000);
}

#[test]
fn test_cannot_deposit_twice() {
    let env = Env::default();
    let (client, members, _) = setup_active_circle(&env, 3);

    client.deposit(&members[0]);
    let result = client.try_deposit(&members[0]);
    assert!(result.is_err());
}

#[test]
fn test_non_member_cannot_deposit() {
    let env = Env::default();
    let (client, _, _) = setup_active_circle(&env, 3);

    let stranger = Address::generate(&env);
    let result = client.try_deposit(&stranger);
    assert!(result.is_err());
}

#[test]
fn test_full_round_triggers_payout_ready() {
    let env = Env::default();
    let (client, members, _) = setup_active_circle(&env, 3);

    for m in &members {
        client.deposit(m);
    }

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.status, CircleStatus::PayoutReady);
}

#[test]
fn test_winner_selection_and_payout() {
    let env = Env::default();
    let (client, members, admin) = setup_active_circle(&env, 3);

    for m in &members {
        client.deposit(m);
    }

    let winner = client.select_winner(&admin);
    assert!(members.contains(&winner));

    client.execute_payout(&admin);

    let winner_data = client.get_member(&winner).unwrap();
    assert!(winner_data.has_received_payout);

    let state = client.get_circle_state().unwrap();
    assert_eq!(state.status, CircleStatus::Active);
    assert_eq!(state.current_round, 2);
}

#[test]
fn test_full_lifecycle_completes() {
    let env = Env::default();
    let n: u32 = 3;
    let (client, members, admin) = setup_active_circle(&env, n);

    for _round in 0..n {
        for m in &members {
            let _ = client.try_deposit(m);
        }
        let state = client.get_circle_state().unwrap();
        if state.status == CircleStatus::PayoutReady {
            client.select_winner(&admin);
            client.execute_payout(&admin);
        }
    }

    let final_state = client.get_circle_state().unwrap();
    assert_eq!(final_state.status, CircleStatus::Completed);
}