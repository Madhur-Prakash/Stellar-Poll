#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
pub enum DataKey {
    Question,
    OptionCount,
    Option(u32),
    Votes(u32),
    HasVoted(Address),
    VoterChoice(Address),
}

#[contract]
pub struct PollContract;

#[contractimpl]
impl PollContract {
    /// Initialize the poll. Can only be called once.
    pub fn initialize(env: Env, question: String, options: Vec<String>) {
        if env.storage().instance().has(&DataKey::Question) {
            panic!("already initialized");
        }
        assert!(options.len() >= 2, "need at least 2 options");
        assert!(options.len() <= 8, "max 8 options");

        env.storage().instance().set(&DataKey::Question, &question);
        let count = options.len();
        env.storage().instance().set(&DataKey::OptionCount, &count);

        for (i, opt) in options.iter().enumerate() {
            let idx = i as u32;
            env.storage().instance().set(&DataKey::Option(idx), &opt);
            env.storage().instance().set(&DataKey::Votes(idx), &0u32);
        }
    }

    /// Cast a vote. Each address may only vote once.
    pub fn vote(env: Env, voter: Address, option: u32) {
        voter.require_auth();

        let count: u32 = env.storage().instance().get(&DataKey::OptionCount).unwrap();
        assert!(option < count, "invalid option");

        if env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::HasVoted(voter.clone()))
            .unwrap_or(false)
        {
            panic!("already voted");
        }

        let current: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Votes(option))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Votes(option), &(current + 1));

        env.storage()
            .persistent()
            .set(&DataKey::HasVoted(voter.clone()), &true);
        env.storage()
            .persistent()
            .set(&DataKey::VoterChoice(voter.clone()), &option);

        env.events().publish(
            (symbol_short!("vote"),),
            (voter, option, current + 1),
        );
    }

    /// Get the poll question.
    pub fn get_question(env: Env) -> String {
        env.storage().instance().get(&DataKey::Question).unwrap()
    }

    /// Get all options as a Vec<String>.
    pub fn get_options(env: Env) -> Vec<String> {
        let count: u32 = env.storage().instance().get(&DataKey::OptionCount).unwrap();
        let mut opts = Vec::new(&env);
        for i in 0..count {
            let opt: String = env.storage().instance().get(&DataKey::Option(i)).unwrap();
            opts.push_back(opt);
        }
        opts
    }

    /// Get vote count for a specific option.
    pub fn get_votes(env: Env, option: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Votes(option))
            .unwrap_or(0)
    }

    /// Get all vote counts as a Vec<u32>.
    pub fn get_all_votes(env: Env) -> Vec<u32> {
        let count: u32 = env.storage().instance().get(&DataKey::OptionCount).unwrap();
        let mut votes = Vec::new(&env);
        for i in 0..count {
            let v: u32 = env
                .storage()
                .instance()
                .get(&DataKey::Votes(i))
                .unwrap_or(0);
            votes.push_back(v);
        }
        votes
    }

    /// Check if an address has voted.
    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::HasVoted(voter))
            .unwrap_or(false)
    }

    /// Get the option chosen by a voter (panics if they haven't voted).
    pub fn get_voter_choice(env: Env, voter: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::VoterChoice(voter))
            .expect("voter has not voted")
    }
}
