
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that NFT can be minted",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let deployerWallet = accounts.get('deployer')!;
        let w1 = accounts.get('wallet_1')!;
        let w2 = accounts.get('wallet_2')!;
    
        let block = chain.mineBlock([
            Tx.contractCall(
              `${deployerWallet.address}.monkeys`,
              'mint',
              [`'${w1.address}`],
              deployerWallet.address
            ),
            Tx.contractCall(
                `${deployerWallet.address}.monkeys`,
                'mint',
                [`'${w2.address}`],
                deployerWallet.address
              ),
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);
        assertEquals(block.receipts[0].result, `(ok u1)`);
        assertEquals(block.receipts[1].result, `(ok u2)`);

        block = chain.mineBlock([

        ]);
        assertEquals(block.receipts.length, 0);
        assertEquals(block.height, 3);
    },
});


Clarinet.test({
    name: "Ensure that NFT can be transferred",
    async fn(chain: Chain, accounts: Map<string, Account>) {

        let deployerWallet = accounts.get('deployer')!;
        let w1 = accounts.get('wallet_1')!;
        let w2 = accounts.get('wallet_2')!;
    
        let block = chain.mineBlock([
            Tx.contractCall(
              `${deployerWallet.address}.monkeys`,
              'mint',
              [`'${w1.address}`],
              deployerWallet.address
            ),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        assertEquals(block.receipts[0].result, `(ok u1)`);

        block = chain.mineBlock([
            Tx.contractCall(
                `${deployerWallet.address}.monkeys`,
                'transfer',
                ['u1', `'${w1.address}`, `'${w2.address}`],
                w1.address
              ),

        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 3);
        assertEquals(block.receipts[0].result, `(ok true)`);
    },
});