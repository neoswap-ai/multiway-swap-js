# multiway-swap-js

### Installation
#### NPM

In your project path:

	$ npm i multiway-swap-js

### Usage

Basic example:

```javascript
const fs = require('fs');
const {generateMultiwaySmartContract, deploySmartContract, makeContractCall} = require('multiway-swap-js')

let rawdata = fs.readFileSync('swap.json'); // JSON file with the multiway trade specifications
let swap = JSON.parse(rawdata);

const sc_code = generateMultiwaySmartContract(
  swap, 
  "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6"
); // Generate the smart contract code

deploySmartContract(
  'Testnet', 
  sc_code, 
  'TEST_2_multiway',
  'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01',
  1000
) // Deploy the contract to the network

makeContractCall(
  'ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF', 'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01',
  swap,
  'ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF',
  'TEST_2_multiway',
  'finalize',
  'Testnet'
) // Interact with the contract.

```

### Example multiway trade json input
```json
{
    "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5" : { // User STX Address
        "token" : -1000000, // STX ammount: if negative the user is sending and if positive user is receiving 
        "send" : [], // Array of nft items that user is sending 
        "receive" : [ // Array of nft items that user is receiving
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales", "token_id": 1}, // contract_id and token_id for each item, also make sure that every item is being sent and received
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.punks", "token_id": 4}
        ] 
    },
    "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG" : {
       "token" : 450000,
       "send" : [
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.punks", "token_id": 4}
        ],
       "receive" : [
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales", "token_id": 3}
        ] 
    },
    "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC" : {
       "token" : 500000,
       "send" : [
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales", "token_id": 1},
            {"contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales", "token_id": 3}
        ],
       "receive" : [] 
    }
}

```

