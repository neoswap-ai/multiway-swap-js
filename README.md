<br />
<div align="center">
  <a href="https://neoswap.ai/wp-content/uploads/2022/08/logo-small-2.png">
    <img src="https://mma.prnewswire.com/media/2009538/NeoSwap_AI_Logo.jpg?w=400" alt="Logo">
  </a>

  <h3 align="center">Multiway Swap on Stacks
</h3>

</div>

# Table of Contents

1. [About The Project](#about-the-project)
2. [Installation](#installation)
3. [Code Example](#code-examples)
4. [License](#license)
5. [Contact](#contact)

# About the Project

A multi-way swap refers to a trading arrangement involving more than two parties, where each party can trade assets in such a way that all participants benefit. This concept is particularly useful in contexts where direct exchanges between two parties might not be possible or optimal.

### Installation

In your project path:

    $ npm i multiway-swap-js

### Code Example

The code below reads multiway trade specifications from a swap.json file, generates a corresponding smart contract, and deploys it to the test network. After deployment, it makes a call to the smart contract to finalize the trade. It uses the multiway-swap-js library functions for generating the contract code, deploying it, and interacting with it.

```javascript
const fs = require("fs");
const {
  generateMultiwaySmartContract,
  deploySmartContract,
  makeContractCall,
} = require("multiway-swap-js");

let rawdata = fs.readFileSync("swap.json"); // JSON file with the multiway trade specifications
let swap = JSON.parse(rawdata);

const sc_code = generateMultiwaySmartContract(
  swap,
  "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6"
); // Generate the smart contract code

deploySmartContract(
  "Testnet",
  sc_code,
  "TEST_2_multiway",
  "b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01",
  1000
); // Deploy the contract to the network

makeContractCall(
  "ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF",
  "b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01",
  swap,
  "ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF",
  "TEST_2_multiway",
  "finalize",
  "Testnet"
); // Interact with the contract.
```

### Example multiway trade json input

```json
{
  "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5": {
    // User STX Address
    "token": -1000000, // STX ammount: if negative the user is sending and if positive user is receiving
    "send": [], // Array of nft items that user is sending
    "receive": [
      // Array of nft items that user is receiving
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales",
        "token_id": 1
      }, // contract_id and token_id for each item, also make sure that every item is being sent and received
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.punks",
        "token_id": 4
      }
    ]
  },
  "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG": {
    "token": 450000,
    "send": [
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.punks",
        "token_id": 4
      }
    ],
    "receive": [
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales",
        "token_id": 3
      }
    ]
  },
  "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC": {
    "token": 500000,
    "send": [
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales",
        "token_id": 1
      },
      {
        "contract": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.whales",
        "token_id": 3
      }
    ],
    "receive": []
  }
}
```

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE.md](LICENSE.md) file for details.

## Contact

kuba.kwiecien@neoswap.ai
