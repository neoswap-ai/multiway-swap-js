const fs = require('fs');
const compile = require('es6-template-strings/compile')
const resolveToString = require('es6-template-strings/resolve-to-string')
const { makeContractCall, makeContractDeploy, broadcastTransaction,
    AnchorMode, FungibleConditionCode, NonFungibleConditionCode,
    makeStandardSTXPostCondition, makeStandardNonFungiblePostCondition,
    uintCV,createAssetInfo } = require('@stacks/transactions');
const { StacksTestnet, StacksMainnet } = require('@stacks/network');
const axios = require("axios").default;

class StacksContractGenerator {

    constructor() {
        this.testnet = {
            network: function () { return new StacksTestnet() },
            apiAddress: "https://stacks-node-api.testnet.stacks.co/extended/v1/"
        },
        this.mainnet = {
            network: function () { return new StacksMainnet() },
            apiAddress: "https://stacks-node-api.mainnet.stacks.co/extended/v1/"
        }
    }

    generateStacksMultiwaySmartContract = (swap_parameters, residual_wallet_address = "") => {

        let traders = ""
        let receivers = ""
        let num_traders = 0
        let num_receivers = 0
        let traders_state = ""
        let deposit_escrow = ""
        let nfts_release_escrow = ""
        let stx_release_escrow = ""
        let traders_return_escrow = ""

        let residual = 0
        Object.keys(swap_parameters).forEach(function(key) {
            residual += swap_parameters[key].token;
        });

        for(const user in swap_parameters){
            if(swap_parameters[user].token >= 0 && swap_parameters[user].send.length == 0){
                num_receivers += 1
                receivers += `(define-constant RECEIVER-${num_receivers} '${user})\n`
                for(const receive of swap_parameters[user].receive){
                    nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender RECEIVER-${num_receivers})))\n`
                }
                if(swap_parameters[user].token > 0){
                    stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender RECEIVER-${num_receivers})))\n`
                }
            } else {
                num_traders += 1
                traders += `(define-constant TRADER-${num_traders} '${user})\n`
                traders_state += `(map-set TraderState TRADER-${num_traders} TRADER_STATE_ACTIVE)\n`
                deposit_escrow += `\t(if (is-eq tx-sender TRADER-${num_traders})\n            (begin\n`
                traders_return_escrow += `\t(if (is-eq (default-to ERR_IS_NOT_TRADER (map-get? TraderState TRADER-1)) TRADER_STATE_CONFIRMED)\n            (begin\n`
                if(swap_parameters[user].token < 0){
                    deposit_escrow += `\t\t(unwrap! (stx-transfer? u${-swap_parameters[user].token} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_STX))\n`
                    traders_return_escrow += `\t\t(unwrap-panic (as-contract (stx-transfer? u${-swap_parameters[user].token} tx-sender TRADER-${num_traders})))\n`
                }
                for(const send of swap_parameters[user].send){
                    deposit_escrow += `\t\t(unwrap! (contract-call? '${send.contract} transfer u${send.token_id} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_NFT))\n`
                    traders_return_escrow += `\t\t(unwrap-panic (as-contract (contract-call? '${send.contract} transfer u${send.token_id} tx-sender TRADER-${num_traders})))\n`
                }
                deposit_escrow += `\t    )\n            true\n        )\n`
                traders_return_escrow += `\t    )\n            true\n        )\n`
                for(const receive of swap_parameters[user].receive){
                    nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender TRADER-${num_traders})))\n`
                }
                if(swap_parameters[user].token > 0){
                    stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender TRADER-${num_traders})))\n`
                }
            }

        }

        if (residual < 0 && residual_wallet_address){
            stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${-residual} tx-sender '${residual_wallet_address})))\n`
        }

        const parameters = {
            traders: traders,
            receivers: receivers,
            num_traders: num_traders,
            traders_state: traders_state,
            deposit_escrow: deposit_escrow,
            nfts_release_escrow: nfts_release_escrow,
            stx_release_escrow: stx_release_escrow,
            traders_return_escrow: traders_return_escrow,
        }

        let sc_data = fs.readFileSync("template.clar", "utf8");
        let sc_compiled = compile(sc_data);
        let sc_content = resolveToString(sc_compiled, parameters);

        return sc_content;
    }

    deploySmartContract = (net, code, contractName, senderKey, address, feeMicroSTX = -1) => {
        return new Promise(async (resolve, reject) => {
        try {
            console.log(contractName + ": deploying smart contract")
            const config = this[net]
            const network = config.network()

            console.log(contractName + ": getting nonce")
            let nonce = await this.getNonce(net, address).catch(console.log)
            console.log(contractName + ": retrieved nonce = " + nonce)

            let txOptions = {
                contractName: contractName,
                codeBody: code,
                senderKey: senderKey,
                network: network,
                anchorMode: AnchorMode.Any,
                nonce: nonce
            };
            if (feeMicroSTX > 0) {
                txOptions["fee"] = BigInt(feeMicroSTX)
            }

            console.log(contractName + ": calling makeContractDeploy()")
            let transaction = await makeContractDeploy(txOptions);
            console.log(contractName + ": makeContractDeploy() successful")

            console.log(contractName + ": calling broadcastTransaction()")
            let broadcastResponse = await broadcastTransaction(transaction, network);
            console.log(contractName + ": broadcastTransaction() successful")
            let txId = broadcastResponse.txid;

            if (broadcastResponse["error"]) {
                console.error(broadcastResponse)
                reject(broadcastResponse)
            } else {
                resolve(txId)
            }
        } catch (error) {
            console.log(error)
            reject({error})
        }
        })
    };

    getNonce = async (net, address, type = "possible") => {
        let apiAddress = this[net].apiAddress;
    
        return new Promise(async (resolve, reject) => {
          axios.get(apiAddress + "address/" + address + "/nonces").
            then((res) => {
              if (type == "possible") {
                resolve(res.data.possible_next_nonce)
              } else if (type == "executed") {
                resolve(res.data.last_executed_tx_nonce)
              } else {
                console.error("Error checking nonce", error)
                reject({ error: "Nonce API failed" })
              }
    
            })
            .catch((error) => {
              console.error("Error checking nonce", error)
              reject({ error: "Nonce API failed" })
            })
        })
      };

      makeContractCall = (userAddress, senderKey, swap_parameters, contractAddress, contractName, contractFunction = "confirm-and-escrow", net = "mainnet", feeMicroSTX = 10000) => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`${contractName}: calling function ${contractFunction}`)
                const config = this[net]
                const network = config.network()

                console.log(contractName + ": getting nonce")
                let nonce = await this.getNonce(net, userAddress).catch(console.log)
                console.log(contractName + ": retrieved nonce = " + nonce)

                let postConditions = []

                if (contractFunction == "confirm-and-escrow") {

                    if (swap_parameters[userAddress].token < 0) {
                      postConditions.push(makeStandardSTXPostCondition(
                        userAddress,
                        FungibleConditionCode.LessEqual,
                        -swap_parameters[userAddress].token
                      ))
                    }

                    /*tradeItems.map(itemId => {
                      const assetInfo = createAssetInfo(items[itemId].collectionAddress, items[itemId].smartContractName, items[itemId].collectionName)
                      postConditions.push(makeStandardNonFungiblePostCondition(
                        userAddress,
                        NonFungibleConditionCode.DoesNotOwn,
                        assetInfo,
                        uintCV(parseInt(items[itemId].nftTokenId))
                      ))
                    })*/
                } else if (contractFunction == "finalize") {

                    
                }

                let txOptions = {
                    contractAddress: contractAddress,
                    contractName: contractName,
                    functionName: contractFunction,
                    functionArgs: [],
                    senderKey: senderKey,
                    network: network,
                    anchorMode: AnchorMode.Any,
                    nonce: nonce,
                    postConditions,
                    postConditionMode: 2
                };
                if (feeMicroSTX > 0) {
                    txOptions["fee"] = BigInt(feeMicroSTX)
                }
    
                console.log(contractName + ": calling makeContractDeploy()")
                let transaction = await makeContractCall(txOptions);
                console.log(contractName + ": makeContractDeploy() successful")
    
                console.log(contractName + ": calling broadcastTransaction()")
                let broadcastResponse = await broadcastTransaction(transaction, network);
                console.log(contractName + ": broadcastTransaction() successful")
                let txId = broadcastResponse.txid;
    
                if (broadcastResponse["error"]) {
                    console.error(broadcastResponse)
                    reject(broadcastResponse)
                } else {
                    resolve(txId)
                }
            } catch (error) {
                console.log(error)
                reject({error})
            }
        })
      };
}

module.exports = StacksContractGenerator