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

### Cast

```shell
$ cast <subcommand>
```

#### play
cast send \
  0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  "play(uint32)" 100 \
  --value 0.01ether \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

cast call \
  0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  "getOutcome(uint256)(bool,address,uint8,uint8,uint8,uint32,uint256,uint256,uint256)" \
  79422106649921001637397064415426712733571798435111936408694041220635280630657 \
  --rpc-url $ARB_SEPOLIA_URL \
  --json

#### withdrawFunds
cast send \
  0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19 \
  "withdrawFunds(address,uint256)" 0x5639Bc2D96c7bA37EECA625599B183241A2bBE6c 297000000000000000 \
  --rpc-url $SEPOLIA_URL \
  --private-key $PRIVATE_KEY

##### transfer
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
