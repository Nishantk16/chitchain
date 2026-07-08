use soroban_sdk::Env;

use crate::{
    storage::{get_circle_state, set_circle_state},
    types::{ChitError, CircleStatus},
};

pub fn transition_to_active(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::Pending => {
            state.status = CircleStatus::Active;
            state.current_round = 1;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::InvalidState),
    }
}

pub fn transition_to_payout_ready(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::Active => {
            state.status = CircleStatus::PayoutReady;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::InvalidState),
    }
}

pub fn transition_to_active_next_round(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::PayoutReady => {
            state.current_round += 1;
            state.status = CircleStatus::Active;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::InvalidState),
    }
}

pub fn transition_to_completed(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::PayoutReady => {
            state.status = CircleStatus::Completed;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::InvalidState),
    }
}

pub fn transition_to_disputed(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::Pending | CircleStatus::Active | CircleStatus::PayoutReady => {
            state.status = CircleStatus::Disputed;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::InvalidState),
    }
}

pub fn transition_to_cancelled(env: &Env) -> Result<(), ChitError> {
    let mut state = get_circle_state(env)?;
    match state.status {
        CircleStatus::Pending => {
            state.status = CircleStatus::Cancelled;
            set_circle_state(env, &state);
            Ok(())
        }
        _ => Err(ChitError::CircleAlreadyActive),
    }
}