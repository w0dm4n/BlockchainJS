import Block from "./block.js"
import Transaction from "./transaction.js"

const sha256 = require("sha256");
const hash_need = "0000" // used to increase the difficulty

const currentNodeUrl = process.argv[3];
export default class Blockchain
{
    constructor()
    {
        this.chain = [];
        this.pendingTransactions = [];
        
        this.networkNodes = [];
        this.createNewBlock(0, '0', '0');
    }

    createNewBlock(nonce, prevBlockHash, hash) {
        let block = new Block({
                id: this.getNewBlockIndex(), 
                transactions: this.pendingTransactions, 
                nonce: nonce, 
                hash: hash,
                prevBlockHash: prevBlockHash,
                timestamp: Date.now() }, false);
        
        this.clearPendingTransactions();
        this.chain.push(block);
        return block;
    }

    getNewBlockIndex() {
        return this.chain.length + 1;
    }

    getNewTransactionIndex() {
        return this.pendingTransactions.length + 1;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    hashBlock(prevBlockHash, currentBlockData, nonce) {
        let rawData = prevBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        let blockHash = sha256(rawData);

        return blockHash;
    }

    proofOfWork(prevBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);

        console.log(`Mining a new block... (${this.pendingTransactions.length} pending transactions)`);
        while (hash.substring(0, hash_need.length) !== hash_need) {
            nonce++;
            hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    createNewTransaction(amount, sender, recipient){
        let transaction = new Transaction({
            id: this.getNewTransactionIndex(),
            amount: amount,
            sender: sender, 
            recipient: recipient,
            timestamp: Date.now()
        }, false);

        this.pendingTransactions.push(transaction);

        return this.getNewBlockIndex();
    }

    clearPendingTransactions() {
        this.pendingTransactions = [];
    }
};
