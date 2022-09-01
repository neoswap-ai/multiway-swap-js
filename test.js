const BlockchainService = require('.')
const fs = require('fs');

let generator = new BlockchainService()

let rawdata = fs.readFileSync('clarity-multiway-swap/swap.json');
let swap = JSON.parse(rawdata);

//const sc_code = generator.generateStacksMultiwaySmartContract(swap, ""); 

//console.log(sc_code);

//generator.deploySmartContract('testnet', sc_code, 'TEST_2_multiway', key, '',1000000)

generator.makeContractCall(userAddress, key, swap, userAddress, contractName, 'finalize', 'testnet')

