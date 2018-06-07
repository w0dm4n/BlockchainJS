import Block from "./block.js"
import Transaction from "./transaction.js"

const sha256 = require("sha256");
const uuid = require("uuid/v1");
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
        this.addNewNode(currentNodeUrl);
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

    addNewBlock(fromRaw) {
        let block = new Block(fromRaw);

        block.transactions = this.pendingTransactions;
        this.clearPendingTransactions();
        this.chain.push(block);
        return block;
    }

    addNewNode(nodeUrl) {
        if (this.networkNodes.indexOf(nodeUrl) == -1) {
            this.networkNodes.push(nodeUrl);
        }
    }

    setBulkNodes(nodes) {
        this.networkNodes = nodes;
    }

    removeNode(nodeUrl) {
        let index = this.networkNodes.indexOf(nodeUrl);
        if (index) {
            this.networkNodes.splice(index, 1);
            console.log(`Node ${nodeUrl} disconnected !`);
        }
    }

    getNewBlockIndex() {
        let block = this.getLastBlock();
        return (block) ? (block.id + 1) : 1;
    }

    getNewTransactionIndex() {
        return uuid().split('-').join('');
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

        // find a way to handle the max % of cpu fucked by the mining process
        console.log(`Mining a new block... (${this.pendingTransactions.length} pending transactions)`);
        while (hash.substring(0, hash_need.length) !== hash_need) {
            nonce++;
            hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    addToPendingTransactions(transaction) {
        this.pendingTransactions.push(transaction);

        console.log(`Transaction ${transaction.id} will be added in block ${this.getNewBlockIndex()}`);
        return this.getNewBlockIndex();
    }

    createNewTransaction(amount, sender, recipient){
        let transaction = new Transaction({
            id: this.getNewTransactionIndex(),
            amount: amount,
            sender: sender, 
            recipient: recipient,
            timestamp: Date.now()
        }, false);

        return transaction;
    }

    clearPendingTransactions() {
        this.pendingTransactions = [];
    }

    isValidChain(chain)
    {
        let validChain = true;
        for (var i = 1; i < chain.length; i++) {
            let curBlock = chain[i];
            let prevBlock = chain[i - 1];
            let hash = this.hashBlock(curBlock.prevBlockHash, {transactions: curBlock.transactions, index: curBlock.id}, curBlock.nonce);

            if (curBlock.prevBlockHash != prevBlock.hash 
                || hash.substring(0, hash_need.length) !== hash_need) {
                validChain = false;
            }
        }
        let genesis = chain[0]; // not sure if thats really usefull
        if (genesis.nonce != 0 || genesis.hash !== '0' || genesis.prevBlockHash !== '0'
            || genesis.transactions.length > 0) {
            validChain = false;
        }
        return validChain;
    }
};
