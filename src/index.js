const { readFileSync } = require("fs");
const path = require("path");
const compile = require("es6-template-strings/compile");
const resolveToString = require("es6-template-strings/resolve-to-string");
const {
  makeContractCall,
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  FungibleConditionCode,
  NonFungibleConditionCode,
  makeStandardSTXPostCondition,
  makeStandardNonFungiblePostCondition,
  uintCV,
  createAssetInfo,
  makeContractSTXPostCondition,
  makeContractNonFungiblePostCondition,
} = require("@stacks/transactions");
const { StacksTestnet, StacksMainnet } = require("@stacks/network");

const sc_data = readFileSync(path.resolve(__dirname, "template.clar"), "utf8");

/**
 * Generates the code for a smart contract tailored for facilitating multiway trades.
 * This function dynamically constructs smart contract code based on the given parameters.
 *
 * @param swap_parameters An object detailing the specifications of the multiway trade.
 *                        Each key represents a participant, and its value contains details
 *                        about tokens to send or receive. Refer to the documentation for
 *                        structure details.
 * @param residual_wallet_address (Optional) A Stacks (STX) wallet address where any residual
 *                                 STX tokens will be sent. Defaults to an empty string if not provided.
 * @param room_id (Optional) A unique identifier for the trading room. Used for tracking and
 *                           reference purposes. Defaults to an empty string if not provided.
 * @param swap_id (Optional) A unique identifier for the swap transaction. Used for logging
 *                           and tracking the swap. Defaults to an empty string if not provided.
 *
 * @returns {string} The generated smart contract code as a string.
 */
exports.generateMultiwaySmartContract = (
  swap_parameters,
  residual_wallet_address = "",
  room_id = "",
  swap_id = ""
) => {
  // Initialization of variables to construct various parts of the smart contract.
  let traders = "";
  let receivers = "";
  let num_traders = 0;
  let num_receivers = 0;
  let traders_state = "";
  let deposit_escrow = "";
  let nfts_release_escrow = "";
  let stx_release_escrow = "";
  let traders_return_escrow = "";

  // Calculate the total residual tokens by summing up the token values from swap_parameters.
  let residual = 0;
  Object.keys(swap_parameters).forEach(function (key) {
    residual += swap_parameters[key].token;
  });

  // Process each user in swap_parameters to construct contract segments for traders and receivers.
  for (const user in swap_parameters) {
    // Handle receivers: participants receiving tokens without sending any.
    if (
      swap_parameters[user].token >= 0 &&
      swap_parameters[user].send.length == 0
    ) {
      num_receivers += 1;
      receivers += `(define-constant RECEIVER-${num_receivers} '${user})\n`;
      // Construct NFTs release escrow clauses for receivers.
      for (const receive of swap_parameters[user].receive) {
        nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender RECEIVER-${num_receivers})))\n`;
      }
      // Construct STX release escrow clause if receiver is also receiving STX tokens.
      if (swap_parameters[user].token > 0) {
        stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender RECEIVER-${num_receivers})))\n`;
      }
    } else {
      // Handle traders: participants both sending and receiving tokens.
      num_traders += 1;
      traders += `(define-constant TRADER-${num_traders} '${user})\n`;
      traders_state += `(map-set TraderState TRADER-${num_traders} TRADER_STATE_ACTIVE)\n`;
      // Construct deposit escrow clauses for traders.
      deposit_escrow += `\t(if (is-eq tx-sender TRADER-${num_traders})\n            (begin\n`;
      traders_return_escrow += `\t(if (is-eq (default-to ERR_IS_NOT_TRADER (map-get? TraderState TRADER-${num_traders})) TRADER_STATE_CONFIRMED)\n            (begin\n`;
      // Handle negative token values for escrow deposits and returns.
      if (swap_parameters[user].token < 0) {
        deposit_escrow += `\t\t(unwrap! (stx-transfer? u${-swap_parameters[user]
          .token} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_STX))\n`;
        traders_return_escrow += `\t\t(unwrap-panic (as-contract (stx-transfer? u${-swap_parameters[
          user
        ].token} tx-sender TRADER-${num_traders})))\n`;
      }
      // Construct NFTs deposit and return escrow clauses for traders.
      for (const send of swap_parameters[user].send) {
        deposit_escrow += `\t\t(unwrap! (contract-call? '${send.contract} transfer u${send.token_id} tx-sender (as-contract tx-sender)) (err ERR_FAILED_TO_ESCROW_NFT))\n`;
        traders_return_escrow += `\t\t(unwrap-panic (as-contract (contract-call? '${send.contract} transfer u${send.token_id} tx-sender TRADER-${num_traders})))\n`;
      }
      deposit_escrow += `\t    )\n            true\n        )\n`;
      traders_return_escrow += `\t    )\n            true\n        )\n`;
      // Construct NFTs release escrow clauses for traders.
      for (const receive of swap_parameters[user].receive) {
        nfts_release_escrow += `\t(unwrap-panic (as-contract (contract-call? '${receive.contract} transfer u${receive.token_id} tx-sender TRADER-${num_traders})))\n`;
      }
      // Construct STX release escrow clause if trader is also receiving STX tokens.
      if (swap_parameters[user].token > 0) {
        stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${swap_parameters[user].token} tx-sender TRADER-${num_traders})))\n`;
      }
    }
  }

  // Handle residual STX tokens by transferring them to the specified residual wallet address.
  if (residual < 0 && residual_wallet_address) {
    num_receivers += 1;
    receivers += `(define-constant RECEIVER-${num_receivers} '${residual_wallet_address})\n`;
    stx_release_escrow += `\t(unwrap-panic (as-contract (stx-transfer? u${-residual} tx-sender RECEIVER-${num_receivers})))\n`;
  }

  if (room_id != "") {
    // make a comment in clarity with this format: RoomId: <room_id>
    room_id = `;; Room: https://neoswap.xyz/rooms/${room_id}`;
  }

  if (swap_id != "") {
    // make a comment in clarity with this format: SwapId: <swap_id>
    swap_id = `;; SwapId: ${swap_id}`;
  }

  // Compile the smart contract with the constructed parameters.
  const parameters = {
    swap_id: swap_id,
    room_id: room_id,
    traders: traders,
    receivers: receivers,
    num_traders: num_traders,
    traders_state: traders_state,
    deposit_escrow: deposit_escrow,
    nfts_release_escrow: nfts_release_escrow,
    stx_release_escrow: stx_release_escrow,
    traders_return_escrow: traders_return_escrow,
  };

  let sc_compiled = compile(sc_data);
  let sc_content = resolveToString(sc_compiled, parameters);
  sc_content = sc_content.replace(/\r/g, "");

  return sc_content;
};

/**
 * Deploy the code of the smart contract for the multiway trade in the stacks blockchain.
 * @param net The network to be used to deploy: Mainnet or Testnet.
 * @param code The smart contract code to be deployed in the stacks network.
 * @param contractName The name of the contract.
 * @param senderKey  A stacks wallet account key.
 * @param feeMicroSTX The fee to be used for the deployment.
 * @param nonce Optional nonce for the transaction. If not provided, it will be automatically handled by the network.
 */
exports.deploySmartContract = (
  net,
  code,
  contractName,
  senderKey,
  feeMicroSTX,
  nonce = null
) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(contractName + ": deploying smart contract");
      const network =
        net == "Mainnet" ? new StacksMainnet() : new StacksTestnet();

      // Only cast nonce to bigint if it is not null
      const bnonce = nonce == null ? null : BigInt(nonce);
      // Prepare the transaction options for contract deployment
      let txOptions = {
        contractName: contractName,
        codeBody: code,
        senderKey: senderKey,
        network: network,
        anchorMode: AnchorMode.Any,
        fee: BigInt(feeMicroSTX),
        nonce: bnonce,
      };

      // if nonce is null remove the nonce from the options
      if (nonce == null) {
        delete txOptions.nonce;
      }

      console.log(contractName + ": calling makeContractDeploy()");
      // Create the contract deployment transaction
      let transaction = await makeContractDeploy(txOptions);
      // Log the successful contract deployment transaction creation
      console.log(contractName + ": makeContractDeploy() successful");

      // Broadcast the transaction to the network
      console.log(contractName + ": calling broadcastTransaction()");
      let broadcastResponse = await broadcastTransaction(transaction, network);
      // Log the successful transaction broadcast
      console.log(contractName + ": broadcastTransaction() successful");
      // Extract the transaction ID from the broadcast response
      let txId = broadcastResponse.txid;

      // Check for errors in the broadcast response and reject the promise if found
      if (broadcastResponse["error"]) {
        console.error(broadcastResponse);
        reject(broadcastResponse);
      } else {
        resolve(txId);
      }
    } catch (error) {
      console.log(error);
      reject({ error });
    }
  });
};

/**
 * Interact with the smart contract for the multiway trade in the stacks blockchain.
 * @param userAddress A object that contains the multiway trade specifications see documentation for more details.
 * @param senderKey A stacks wallet account key.
 * @param swap_parameters A object that contains the multiway trade specifications see documentation for more details.
 * @param contractAddress The stacks address of the contract.
 * @param contractName The name of the contract.
 * @param contractFunction Which contract function to be called: confirm-and-escrow or finalize.
 * @param net Network to be used for the contract call: Mainnet or Testnet.
 */
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
      console.log(`${contractName}: calling function ${contractFunction}`);
      const network =
        net == "Mainnet" ? new StacksMainnet() : new StacksTestnet();

      let postConditions = [];

      if (contractFunction == "confirm-and-escrow") {
        // Create a post condition for STX tokens
        if (swap_parameters[userAddress].token < 0) {
          postConditions.push(
            makeStandardSTXPostCondition(
              userAddress,
              FungibleConditionCode.LessEqual,
              -swap_parameters[userAddress].token
            )
          );
        }

        // Map over the items to be sent and create non-fungible post conditions
        swap_parameters[userAddress].send.map((item) => {
          const itemContractAddress = item.contract.split(".")[0];
          const itemContractName = item.contract.split(".")[1];
          const assetInfo = createAssetInfo(
            itemContractAddress,
            itemContractName,
            itemContractName
          );
          postConditions.push(
            makeStandardNonFungiblePostCondition(
              userAddress,
              NonFungibleConditionCode.DoesNotOwn,
              assetInfo,
              uintCV(parseInt(item.token_id))
            )
          );
        });
      } else if (contractFunction == "finalize") {
        let total_stx_send = 0;
        // Iterate over each user address to handle their part in the swap
        for (const userAddress in swap_parameters) {
          if (swap_parameters[userAddress].token > 0) {
            total_stx_send += swap_parameters[userAddress].token;
          }
          swap_parameters[userAddress].receive.map((item) => {
            const itemContractAddress = item.contract.split(".")[0];
            const itemContractName = item.contract.split(".")[1];
            // Create asset information for the NFT
            const assetInfo = createAssetInfo(
              itemContractAddress,
              itemContractName,
              itemContractName
            );
            // Create a contract-based post condition for the non-fungible token
            postConditions.push(
              makeContractNonFungiblePostCondition(
                contractAddress,
                contractName,
                NonFungibleConditionCode.DoesNotOwn,
                assetInfo,
                uintCV(parseInt(item.token_id))
              )
            );
          });
        }
        // Create a post condition for the total STX to be sent
        postConditions.push(
          makeContractSTXPostCondition(
            contractAddress,
            contractName,
            FungibleConditionCode.GreaterEqual,
            total_stx_send
          )
        );
      }

      // Prepare the transaction options
      let txOptions = {
        contractAddress: contractAddress,
        contractName: contractName,
        functionName: contractFunction,
        functionArgs: [],
        senderKey: senderKey,
        network: network,
        anchorMode: AnchorMode.Any,
        postConditions,
        postConditionMode: 2,
      };

      console.log(contractName + ": calling makeContractCall()");
      let transaction = await makeContractCall(txOptions);
      console.log(contractName + ": makeContractCall() successful");

      console.log(contractName + ": calling broadcastTransaction()");
      // Broadcast the transaction to the network
      let broadcastResponse = await broadcastTransaction(transaction, network);
      console.log(contractName + ": broadcastTransaction() successful");
      // Extract the transaction ID from the broadcast response
      let txId = broadcastResponse.txid;

      if (broadcastResponse["error"]) {
        console.error(broadcastResponse);
        reject(broadcastResponse);
      } else {
        resolve(txId);
      }
    } catch (error) {
      console.log(error);
      reject({ error });
    }
  });
};
