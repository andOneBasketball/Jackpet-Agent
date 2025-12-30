## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```
#### SEPOLIA
forge script script/deploy/sepolia/Jackpet.s.sol:JackpetScript --rpc-url $SEPOLIA_URL --private-key $PRIVATE_KEY --broadcast -vvvv
forge verify-contract --chain-id 11155111 \
    --num-of-optimizations 500 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(address,bytes32,uint256,uint256,uint32)" "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B" "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae" 32385588637373844920823943478370010271717458688826519693091571058749410633259 10000000000000000 10000) \
    --verifier etherscan \
    --etherscan-api-key $EVM_API_KEY \
    0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
    src/Jackpet.sol:Jackpet

#### arbTestnet
forge script script/deploy/arbTestnet/Jackpet.s.sol:JackpetScript --rpc-url $ARB_SEPOLIA_URL --private-key $PRIVATE_KEY --broadcast -vvvv
forge verify-contract --chain-id 421614 \
    --num-of-optimizations 500 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(address,bytes32,uint256,uint256,uint32)" "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61" "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be" 40151870665596170781987746063650977219388333038745243125103493267748337392849 10000000000000000 10000) \
    --verifier etherscan \
    --etherscan-api-key $EVM_API_KEY \
    0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
    src/Jackpet.sol:Jackpet

#### BSC Testnet
forge script script/deploy/bscTestnet/Jackpet.s.sol:JackpetScript --rpc-url $BSC_TESTNET_URL --private-key $PRIVATE_KEY --broadcast --legacy --with-gas-price 1gwei -vvvv
forge verify-contract --chain-id 97 \
    --num-of-optimizations 500 \
    --watch \
    --constructor-args $(cast abi-encode "constructor(address,bytes32,uint256,uint256,uint32)" "0xDA3b641D438362C440Ac5458c57e00a712b66700" "0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26" 72280575575369334062451027855862925776312375794399525949111572405623193491458 10000000000000000 10000) \
    --verifier etherscan \
    --etherscan-api-key $EVM_API_KEY \
    0x567718FcDd5a7F880C55e50C5e7afF99d5Ef9BF9 \
    src/Jackpet.sol:Jackpet
forge script script/call/bscTestnet/JackpetPlay.s.sol:JackpetCallScript --rpc-url $BSC_TESTNET_URL --private-key $PRIVATE_KEY --broadcast --legacy --with-gas-price 1gwei -vvvv

### Cast

```shell
$ cast <subcommand>
```

#### play
cast send \
  0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
  "play(uint32)" 100 \
  --value 0.01ether \
  --rpc-url $ARB_SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast send \
  0x95Af6c253E53fC8Ccb7D23911fEb291d22135F3B \
  "play(uint32)" 100 \
  --value 0.01ether \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast call \
  0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
  "getOutcome(uint256)(bool,address,uint8,uint8,uint8,uint32,uint256,uint256,uint256)" \
  79422106649921001637397064415426712733571798435111936408694041220635280630657 \
  --rpc-url $ARB_SEPOLIA_URL \
  --json

#### withdrawFunds
cast send \
  0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
  "withdrawFunds(address,uint256)" 0x5639Bc2D96c7bA37EECA625599B183241A2bBE6c 200000000000000000 \
  --rpc-url $ARB_SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast send \
  0x95Af6c253E53fC8Ccb7D23911fEb291d22135F3B \
  "withdrawFunds(address,uint256)" 0x5639Bc2D96c7bA37EECA625599B183241A2bBE6c 297000000000000000 \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

##### transfer
cast send \
  0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
  --value 0.2ether \
  --rpc-url $ARB_SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast send \
  0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  --value 0.01ether \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

##### deposit
cast send \
  0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  "deposit()" \
  --value 0.2ether \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

##### addConsumer
cast send 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61 \
  "addConsumer(uint256,address)" 40151870665596170781987746063650977219388333038745243125103493267748337392849 0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7 \
  --rpc-url $ARB_SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast send 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B \
  "addConsumer(uint256,address)" 32385588637373844920823943478370010271717458688826519693091571058749410633259 0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
