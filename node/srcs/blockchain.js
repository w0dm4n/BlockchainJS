import Block from "./block.js"
import Transaction from "./transaction.js"
import Utils from "./utils.js"
import { generate } from "randomstring/lib/randomstring";

const sha256 = require("sha256");
const uuid = require("uuid/v1");
const fs = require("fs");
const rp = require("request-promise");

const currentNodeUrl = process.argv[3];
export default class Blockchain
{
    constructor()
    {
        this.hash_need = "0000" // used to increase the difficulty
        this.chain = [];
        this.pendingTransactions = [];
        
        this.miningReward = 0.5;
        this.networkNodes = [];
        this.pendingBlocks = [];

        this.nodesIndexers = ["http://localhost:3333"];

        if (!this.loadChain()) {
            let genesisBlock = this.createNewBlock(0, '0', '0', []);
            genesisBlock.minedBy = "000000000000000000000000000";

            this.addReward(genesisBlock, this.miningReward, true);
            this.addNewBlock(genesisBlock);
        }

        this.addNewNode(currentNodeUrl);
        this.currentNodeAddress();
        this.rewardEvent();

        this.nodesWatcher();

        for (var indexer of this.nodesIndexers) {
            this.syncIndexer(indexer, false);
        }
    }

    syncIndexer(indexer, pushIt)
    {
        console.log(`Connecting to indexer ${indexer}`);
        rp({
            method: "POST",
            uri: `${indexer}/connect`,
            body: {nodeUrl: currentNodeUrl},
            json: true,
            timeout: 1500
        }).then((answer) => {
            if (pushIt) {
                this.nodesIndexers.push(indexer);
            }

            if (!answer || !answer.nodes)
                return;
            
            for (var node of answer.nodes) {
                this.getFromNodeAndConnect(node.url);
            }
        }).catch(() => {
            this.removeIndexer(indexer);
        });
    }

    getFromNodeAndConnect(nodeUrl)
    {
        if (this.networkNodes.indexOf(nodeUrl) == -1) {
            rp({
                method: "POST",
                uri: `${nodeUrl}/ping`,
                body: {nodes: this.networkNodes},
                json: true,
                timeout: 1500
            }).then((answer) => {
                if (answer && answer.alive && answer.nodes && answer.indexers) {
                    this.addNewNode(nodeUrl);

                    for (var node of answer.nodes) {
                        if (this.networkNodes.indexOf(node) == -1) {
                            getFromNodeAndConnect(node);
                        }
                    }

                    for (var indexer of answer.indexers) {
                        if (this.nodesIndexers.indexOf(indexer) == -1) {
                            syncIndexer(indexer, true);
                        } 
                    }
                }
            }).catch(() => {});
        }
    }

    nodesWatcher()
    {
        setInterval(() => {
            
            let i = 0;
            let nodesCount = this.networkNodes.length;

            for (var node of this.networkNodes) {
                ((currentNode) => {
                    rp({
                        method: "POST",
                        uri: `${currentNode}/ping`,
                        body: {nodes: this.networkNodes},
                        json: true,
                        timeout: 1500
                    }).then((answer) => {
                        i++;
                        if (answer && answer.alive && answer.nodes && answer.indexers) {
                            for (var node of answer.nodes) {
                                if (this.networkNodes.indexOf(node) == -1) {
                                    getFromNodeAndConnect(node);
                                }
                            }
        
                            for (var indexer of answer.indexers) {
                                if (this.nodesIndexers.indexOf(indexer) == -1) {
                                    syncIndexer(indexer, true);
                                } 
                            }
                        } else {
                            this.removeNode(currentNode);
                        }
                        if (i == nodesCount) {
                            this.doConsensus();
                        }
                    }).catch(() => {
                        i++;
                        this.removeNode(currentNode);

                        if (i == nodesCount) {
                            this.doConsensus();
                        }
                    });
                })(node);
            }
        }, 5000);
    }

    generateNewWallet()
    {
        var EC = require('elliptic').ec;
        var ec = new EC('secp256k1');
        
        var key = ec.genKeyPair();
        let hexPub = "04" + key.getPublic().x.toString(16) + key.getPublic().y.toString(16);
        return {private_key: key.getPrivate().toString(16), public_key: hexPub};
    }

    currentNodeAddress()
    {
        try {
            let contents = fs.readFileSync("node_address.json");
            return JSON.parse(contents.toString());
        }
        catch (e) 
        {
            let wallet = this.generateNewWallet();
            fs.writeFileSync("node_address.json", JSON.stringify(wallet), "utf8");
            return wallet;
        }
    }

    addPendingBlock(block)
    {
        let lastBlock = this.getLastBlock();
        if (block.prevBlockHash != lastBlock.hash || block.id != (lastBlock.id + 1)) {
            return;
        }
        this.pendingBlocks.push(block);

        this.dumpChain();
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
            }
        }
    }

    doConsensus()
    {
        rp({
            method: "GET",
            uri: `${currentNodeUrl}/consensus`,
            body: {},
            json: true,
            timeout: 1500
        }).then(() => {}).catch(() => {});
    }

    checkNewBlock(block)
    {
        if (block.id == 2 && block.transactions.length == 1 
            && block.transactions[0].recipient == "000000000000000000000000000") { // first mined block should contain only one transaction (from the genesis)
            return true;
        }
        for (var transaction of block.transactions) {
            let sender = this.getAddressData(transaction.sender);
            if (sender.balance < transaction.amount
                 && transaction.sender != transaction.recipient) {
                return false;
            }
        }
        return true;
    }

    createNewBlock(nonce, prevBlockHash, hash, transactions) {
        let block = new Block({
                id: this.getNewBlockIndex(), 
                transactions: transactions, 
                nonce: nonce,
                hash: hash,
                prevBlockHash: prevBlockHash,
                timestamp: Date.now(),
                minedBy: this.currentNodeAddress().public_key }, false);
        
        return block;
    }

    addNewBlock(fromRaw) {
        let block = new Block(fromRaw);

        this.clearInBlockTransaction(block);
        this.chain.push(block);

        this.dumpChain();
        return block;
    }

    addNewNode(nodeUrl) {
        if (this.networkNodes.indexOf(nodeUrl) == -1) {
            this.networkNodes.push(nodeUrl);
            
            this.dumpChain();
        }
    }

    setBulkNodes(nodes) {
        this.networkNodes = nodes;
    }

    removeNode(nodeUrl) {
        let index = this.networkNodes.indexOf(nodeUrl);
        if (index) {
            this.networkNodes.splice(index, 1);
        }
    }

    removeIndexer(indexer) {
        let index = this.nodesIndexers.indexOf(indexer);
        if (index) {
            this.nodesIndexers.splice(index, 1);
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

    addToPendingTransactions(transaction) {
        this.pendingTransactions.push(transaction);
        this.dumpChain();
    }

    validAddress(addr) {
        //(addr.length == this.generateNewWallet().public_key.length) == true && (
        return (addr.match("^[a-zA-Z0-9]*$") != null);
    }

    createNewTransaction(hash, amount, sender, recipient, signature, initiated){
        let transaction = new Transaction({
            id: hash,
            amount: amount,
            sender: sender, 
            recipient: recipient,
            timestamp: initiated,
            signature: signature,
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

        var EC = require('elliptic').ec;
        var ec = new EC('secp256k1');
        for (var block of chain) {
            for (var transaction of block.transactions)
            {
                if (transaction.signature === "000000000000000000000000000") { // mining reward
                    continue;
                }
                let key = ec.keyFromPublic(transaction.sender, "hex");
                let signature = Utils.convertHexStringToNumArray(transaction.signature);
                
                let t = {
                    amount: transaction.amount,
                    recipient: transaction.recipient,
                    sender: transaction.sender,
                    initiated: transaction.timestamp
                }
                
                let txHash = sha256(JSON.stringify(t));
                if (!key.verify(txHash, signature)) {
                    return false;
                }
            }
        }
        return validChain;
    }

    getAddressData(address) {
        let results = {received: [], sent: [], balance: 0.00};

        for (var block of this.chain) {
            for (var transaction of block.transactions)
            {
                if (transaction.recipient === address && transaction.sender === address) { // from mining
                    results.balance += transaction.amount;
                    continue;
                }

                if (transaction.sender === address) { results.sent.push(transaction); results.balance -= transaction.amount; }
                if (transaction.recipient === address) { results.received.push(transaction); results.balance += transaction.amount; }
            }
        }
        return results;
    }

    addReward(block, reward, genesis)
    {
        let t = {
            amount: reward,
            recipient: block.minedBy,
            sender: block.minedBy,
            initiated: block.timestamp 
        }
    
        let hash = sha256(JSON.stringify(t));
        let newTransaction = this.createNewTransaction(hash, reward, block.minedBy, block.minedBy, "000000000000000000000000000", block.timestamp);
        if (genesis) {
            newTransaction.id = 1;
            newTransaction.timestamp = 0;
        }
        this.addToPendingTransactions(newTransaction);
    }

    rewardEvent() {
        setInterval(() => {
            if (this.pendingBlocks.length > 0) {
                let lastBlock = this.getLastBlock();
                let winnerBlockIndex = (lastBlock.nonce - this.getNewBlockIndex()) % this.pendingBlocks.length;
                if (winnerBlockIndex < 0) {
                    winnerBlockIndex = -winnerBlockIndex;
                }
                
                let winnerBlock = this.pendingBlocks[winnerBlockIndex];
                console.log(`${winnerBlock.minedBy} won the blocks fight ! Congratulations for the reward of ${this.miningReward}`);
                this.addNewBlock(winnerBlock);
                this.pendingBlocks = [];

                this.addReward(winnerBlock, this.miningReward, false);

                if (!this.isValidChain(this.chain)) {
                        rp({
                            method: "POST",
                            uri: `${currentNodeUrl}/consensus`,
                            body: { nodes: this.blockchain.networkNodes },
                            json: true,
                            timeout: 1500
                        }).then(() => {}).catch(() => {});
                }
            }
        }, Utils.getMilliSecondsByMinutes(2));
    }

    dumpChain() {
        fs.writeFileSync("chain.json", JSON.stringify({pending: this.pendingTransactions, chain: this.chain, nodesIndexers: this.nodesIndexers, nodes: this.networkNodes}), "utf8");
    }

    loadChain() {
        try {
            let chainContents = fs.readFileSync("chain.json");
            if (chainContents) {
                let datas = JSON.parse(chainContents.toString());
                this.chain = datas.chain;
                this.pendingTransactions = datas.pending;
                this.nodesIndexers = datas.nodesIndexers;
                this.networkNodes = datas.nodes;
            }
            return true;
        } catch (e) { 
            return false;
        }
    }
};
