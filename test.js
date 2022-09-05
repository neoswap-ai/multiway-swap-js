// const BlockchainService = require('.')
const fs = require('fs');
const {generateMultiwaySmartContract, deploySmartContract, makeContractCall} = require('.')
const {makeRandomPrivKey} = require('@stacks/transactions')

// let generator = new BlockchainService()

let rawdata = fs.readFileSync('clarity-multiway-swap/swap.json');
let swap = JSON.parse(rawdata);

const sc_code = generateMultiwaySmartContract(swap, ""); 

console.log(sc_code);

// deploySmartContract('Testnet', sc_code, 'TEST_2_multiway', 'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01', 1000)

makeContractCall('ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF', 'b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01', swap, 'ST2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXH4HF6PF', 'TEST_2_multiway', 'finalize', 'testnet')

