const {readFileSync} = require('fs');
const path = require('path')
const compile = require('es6-template-strings/compile')
const resolveToString = require('es6-template-strings/resolve-to-string')
const { makeContractCall, makeContractDeploy, broadcastTransaction,
    AnchorMode, FungibleConditionCode, NonFungibleConditionCode,
    makeStandardSTXPostCondition, makeStandardNonFungiblePostCondition,
    uintCV, createAssetInfo, makeContractSTXPostCondition,
    makeContractNonFungiblePostCondition } = require('@stacks/transactions');
const { StacksTestnet, StacksMainnet } = require('@stacks/network');
// const axios = require("axios").default;

const sc_data = readFileSync(path.resolve(__dirname, "template.clar"), "utf8");
// const apiAddress = {
//     Mainnet: "https://stacks-node-api.mainnet.stacks.co/extended/v1/",
//     Testnet: "https://stacks-node-api.testnet.stacks.co/extended/v1/"
// }

// getNonce = async (net, address) => {
//     return new Promise(async (resolve, reject) => {
//       axios.get(apiAddress[net] + "address/" + address + "/nonces").
//         then((res) => {
//             const nonce = res.data.last_executed_tx_nonce ? res.data.last_executed_tx_nonce : 0
//             resolve(nonce)
//         })
//         .catch((error) => {
//           console.error("Error checking nonce", error)
//           reject({ error: "Nonce API failed" })
//         })
//     })
// };

exports.generateMultiwaySmartContract = (swap_parameters, residual_wallet_address = "") => {

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
    Object.keys(swap_parameters).forEach(function (key) {
        residual += swap_parameters[key].token;
    });

    for (const user in swap_parameters) {
        if (swap_parameters[user].token >= 0 && swap_parameters[user].send.length == 0) {
            num_receivers += 1
            receivers += `(define-constant RECEIVER-${num_receivers} '${user})\n`
            for (const receive of swap_parameters[user].receive) {
                nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender RECEIVER-${num_receivers})))\n`
            }
            if (swap_parameters[user].token > 0) {
                stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender RECEIVER-${num_receivers})))\n`
            }
        } else {
            num_traders += 1
            traders += `(define-constant TRADER-${num_traders} '${user})\n`
            traders_state += `(map-set TraderState TRADER-${num_traders} TRADER_STATE_ACTIVE)\n`
            deposit_escrow += `\t(if (is-eq tx-sender TRADER-${num_traders})\n            (begin\n`
            traders_return_escrow += `\t(if (is-eq (default-to ERR_IS_NOT_TRADER (map-get? TraderState TRADER-1)) TRADER_STATE_CONFIRMED)\n            (begin\n`
            if (swap_parameters[user].token < 0) {
                deposit_escrow += `\t\t(unwrap! (stx-transfer? u${-swap_parameters[user].token} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_STX))\n`
                traders_return_escrow += `\t\t(unwrap-panic (as-contract (stx-transfer? u${-swap_parameters[user].token} tx-sender TRADER-${num_traders})))\n`
            }
            for (const send of swap_parameters[user].send) {
                deposit_escrow += `\t\t(unwrap! (contract-call? '${send.contract} transfer u${send.token_id} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_NFT))\n`
                traders_return_escrow += `\t\t(unwrap-panic (as-contract (contract-call? '${send.contract} transfer u${send.token_id} tx-sender TRADER-${num_traders})))\n`
            }
            deposit_escrow += `\t    )\n            true\n        )\n`
            traders_return_escrow += `\t    )\n            true\n        )\n`
            for (const receive of swap_parameters[user].receive) {
                nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender TRADER-${num_traders})))\n`
            }
            if (swap_parameters[user].token > 0) {
                stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender TRADER-${num_traders})))\n`
            }
        }

    }

    if (residual < 0 && residual_wallet_address) {
        num_receivers += 1
        receivers += `(define-constant RECEIVER-${num_receivers} '${residual_wallet_address})\n`
        stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${-residual} tx-sender RECEIVER-${num_receivers})))\n`
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

    let sc_compiled = compile(sc_data);
    let sc_content = resolveToString(sc_compiled, parameters);

    return sc_content;
}


exports.deploySmartContract = (net, code, contractName, senderKey, feeMicroSTX) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(contractName + ": deploying smart contract")
            const network = net == "Mainnet" ? new StacksMainnet() : new StacksTestnet()

            let txOptions = {
                contractName: contractName,
                codeBody: code,
                senderKey: senderKey,
                network: network,
                anchorMode: AnchorMode.Any,
                fee: BigInt(feeMicroSTX)
            };

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
            reject({ error })
        }
    })
};

exports.makeContractCall = (
    userAddress,
    senderKey,
    swap_parameters,
    contractAddress,
    contractName,
    contractFunction = "confirm-and-escrow",
    net = "Mainnet"
) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`${contractName}: calling function ${contractFunction}`)
            const network = net == "Mainnet" ? new StacksMainnet() : new StacksTestnet()

            let postConditions = []

            if (contractFunction == "confirm-and-escrow") {

                if (swap_parameters[userAddress].token < 0) {
                    postConditions.push(makeStandardSTXPostCondition(
                        userAddress,
                        FungibleConditionCode.LessEqual,
                        -swap_parameters[userAddress].token
                    ))
                }

                swap_parameters[userAddress].send.map(item => {
                    const itemContractAddress = item.contract.split(".")[0]
                    const itemContractName = item.contract.split(".")[1]
                    const assetInfo = createAssetInfo(itemContractAddress, itemContractName, itemContractName)
                    postConditions.push(makeStandardNonFungiblePostCondition(
                        userAddress,
                        NonFungibleConditionCode.DoesNotOwn,
                        assetInfo,
                        uintCV(parseInt(item.token_id))
                    ))
                })
            } else if (contractFunction == "finalize") {
                let total_stx_send = 0
                for (const userAddress in swap_parameters) {
                    if (swap_parameters[userAddress].token > 0) {
                        total_stx_send += swap_parameters[userAddress].token
                    }
                    swap_parameters[userAddress].receive.map(item => {
                        const itemContractAddress = item.contract.split(".")[0]
                        const itemContractName = item.contract.split(".")[1]
                        const assetInfo = createAssetInfo(itemContractAddress, itemContractName, itemContractName)
                        postConditions.push(makeContractNonFungiblePostCondition(
                            contractAddress,
                            contractName,
                            NonFungibleConditionCode.DoesNotOwn,
                            assetInfo,
                            uintCV(parseInt(item.token_id))
                        ))
                    })
                }
                postConditions.push(makeContractSTXPostCondition(
                    contractAddress,
                    contractName,
                    FungibleConditionCode.GreaterEqual,
                    total_stx_send
                ))
            }

            let txOptions = {
                contractAddress: contractAddress,
                contractName: contractName,
                functionName: contractFunction,
                functionArgs: [],
                senderKey: senderKey,
                network: network,
                anchorMode: AnchorMode.Any,
                // nonce: nonce,
                postConditions,
                postConditionMode: 2
            };

            console.log(contractName + ": calling makeContractCall()")
            let transaction = await makeContractCall(txOptions);
            console.log(contractName + ": makeContractCall() successful")

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
            reject({ error })
        }
    })
};
