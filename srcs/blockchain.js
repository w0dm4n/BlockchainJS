import Block from "./block.js"
import Transaction from "./transaction.js"

const sha256 = require("sha256");
const uuid = require("uuid/v1");

const currentNodeUrl = process.argv[3];
export default class Blockchain
{
    constructor()
    {
        this.hash_need = "000000" // used to increase the difficulty
        this.chain = [];
        this.pendingTransactions = [];
        
        this.miningReward = 0.5;
        this.networkNodes = [];
        this.createNewBlock(0, '0', '0', []);
        this.addNewNode(currentNodeUrl);
    }

    findPendingTransaction(id)
    {
        let i = 0;
        for (var transaction of this.pendingTransactions) {
            if (transaction.id == id) {
                return i;
            }
            i++;
        }
        return -1;
    }

    clearInBlockTransaction(block) {
        for (var transaction of block.transactions) {
            let index = this.findPendingTransaction(transaction.id);
            if (index != -1) {
                this.pendingTransactions.splice(index, 1);
                //console.log(`Transaction ${transaction.id} verified by block ${block.id}`);
            }
        }
    }

    createNewBlock(nonce, prevBlockHash, hash, transactions) {
        let block = new Block({
                id: this.getNewBlockIndex(), 
                transactions: transactions, 
                nonce: nonce,
                hash: hash,
                prevBlockHash: prevBlockHash,
                timestamp: Date.now() }, false);
        
        this.clearInBlockTransaction(block);
        this.chain.push(block);
        return block;
    }

    addNewBlock(fromRaw) {
        let block = new Block(fromRaw);

        this.clearInBlockTransaction(block);
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

        // find a way to handle the powerness of cpu fucked by the mining process
        console.log(`Mining a new block... (${this.pendingTransactions.length} pending transactions)`);
        while (hash.substring(0, this.hash_need.length) !== this.hash_need) {
            nonce++;
            hash = this.hashBlock(prevBlockHash, currentBlockData, nonce);
            // sleep by microsec / cpu tick
        }
        return nonce;
    }

    addToPendingTransactions(transaction) {
        let datas = this.getAddressData(transaction.sender);

        if (datas.balance >= transaction.amount) {
            this.pendingTransactions.push(transaction);
            return true;
        }
        return false
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
                || hash.substring(0, this.hash_need.length) !== this.hash_need) {
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

    getAddressData(address) {
        let results = {received: [], sent: [], balance: 0.00};

        for (var block of this.chain) {
            for (var transaction of block.transactions)
            {
                if (transaction.sender === address) { results.sent.push(transaction); results.balance -= transaction.amount; }
                if (transaction.recipient === address) { results.recipient.push(transaction); results.balance += transaction.amount; }
            }
        }
        if (address === "00")  { // base address
            results.balance = this.miningReward;
        }
        return results;
    }
};
