const rp = require("request-promise");
const sha256 = require("sha256");

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

let pub = "047b891e3ac997721c99758be15fda78d47ca797cf3ea775b3b9497f60708dc1f3bb2545afaf5f6073549c49d0b8b883f7a15bdf3f5b8ed15b0d4c7a3042349cfb";
let priv = "29e1f1615f0263cbad31b404852286c303f89858c45cca87048174ef302ee489";

let node = "http://localhost:3000";

let amount = process.argv[2];
let recipient = process.argv[3];

let transaction = {
    amount: Number(amount),
    recipient: recipient,
    sender: pub,
    initiated: Date.now()
}

let hash = sha256(JSON.stringify(transaction));
let key = ec.keyFromPrivate(priv);
transaction.signature = key.sign(hash).toDER();

rp({
    method: "POST",
    uri: `${node}/transaction/broadcast`,
    body: transaction,
    json: true,
    timeout: 1500
}).then((answer) => {console.log(answer);}).catch(() => {});

console.log(transaction, `sent to node ${node}`);
