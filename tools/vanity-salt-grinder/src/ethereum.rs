use ethers_core::{
    types::{Address, H256},
    utils::keccak256,
};
use rlp::RlpStream;

pub fn predict_create2_address(deployer: Address, salt: H256, init_code_hash: H256) -> Address {
    let mut bytes = [0u8; 85];
    bytes[0] = 0xff;
    bytes[1..21].copy_from_slice(deployer.as_bytes());
    bytes[21..53].copy_from_slice(salt.as_bytes());
    bytes[53..85].copy_from_slice(init_code_hash.as_bytes());

    Address::from_slice(&keccak256(bytes)[12..])
}

pub fn predict_create_address(deployer: Address, nonce: u64) -> Address {
    let mut stream = RlpStream::new_list(2);
    stream.append(&deployer);
    stream.append(&nonce);

    Address::from_slice(&keccak256(stream.out())[12..])
}
