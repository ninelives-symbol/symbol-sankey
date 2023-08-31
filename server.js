// Establish MongoDB connection when the server starts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import connectToDbWithReconnection from './mongo_connect.js';
import fetchData from './querydb.js';
import cors from 'cors';
import fs from 'fs';


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(path.join(__dirname, 'html/public'))); // Serve your HTML file
app.use(cors({
    origin: process.env.WEBHOST
}));

function hexToBigInt(hexString) {
  return BigInt(`0x${hexString}`);
}

// Establish MongoDB connection when the server starts
let client;
connectToDbWithReconnection()
    .then(dbClient => {
        client = dbClient;
    })
    .catch(error => {
        console.error("Failed to connect to MongoDB", error);
        process.exit(1);  // Exit the process if connection fails
    });


app.get('/data', async function(req, res) {
    const address = req.query.address;  // Get address from query parameters
    const depth = Number(req.query.depth);  // Get depth from query parameters
    const minAmount = Number(req.query.minAmount);  // Get minAmount from query parameters
    const mosaic = req.query.mosaic;  // Get mosaic from query parameters
    const divisibility = Number(req.query.divisibility);  // Get divisibility from query parameters


    // Split the address string into an array of addresses
    const addresses = address.split(',');

    // Convert the mosaic ID from hexadecimal to integer
    const mosaicId = hexToBigInt(mosaic);



    console.log(`Received request with addresses: ${addresses}, depth: ${depth}, minAmount: ${minAmount}, mosaic: ${mosaicId} and divisibility ${divisibility}`);

    if (!addresses || !depth || !minAmount || !mosaic) {
        res.status(400).send('Address, depth, minAmount, and mosaic parameters must be provided');
        return;
    }

    try {
        if (!client) {
            res.status(500).send('Error connecting to MongoDB');
            return;
        }

        const txs = await fetchData(client, addresses, depth, minAmount, mosaicId, divisibility);

        const nodeMap = new Map(); // Use a Map for efficient node lookup
        const nodes = [];
        const links = [];

        let otherSentNodeValue = 0;
        let otherReceivedNodeValue = 0;

        const mainNode = { name: address, sent: 0, received: 0 };
        nodes.push(mainNode);
        nodeMap.set(address, mainNode);
        const mainNodeIndex = nodes.indexOf(mainNode);

        txs.forEach((tx, index) => {
            console.log(`Processing transaction #${index + 1}`);
            console.log(`Sender: ${tx.sender}, Recipient: ${tx.recipient}, Amount: ${tx.amount}`);

            let senderNode = nodeMap.get(tx.sender);
            if (!senderNode) {
                console.log(`Creating new node for sender: ${tx.sender}`);
                senderNode = { name: tx.sender, sent: 0, received: 0 };
                nodes.push(senderNode);
                nodeMap.set(tx.sender, senderNode);
            }

            let recipientNode = nodeMap.get(tx.recipient);
            if (!recipientNode) {
                console.log(`Creating new node for recipient: ${tx.recipient}`);
                recipientNode = { name: tx.recipient, sent: 0, received: 0 };
                nodes.push(recipientNode);
                nodeMap.set(tx.recipient, recipientNode);
            }

            if (tx.amount >= minAmount) {
                senderNode.sent += tx.amount;
                recipientNode.received += tx.amount;
				const hashHex = tx.hash.toString('hex');
                links.push({
                    source: nodes.indexOf(senderNode),
                    target: nodes.indexOf(recipientNode),
                    value: tx.amount,
		    hash: hashHex
                });
            }

            // Correctly add transactions to "Other" categories
            if (tx.sender === address && tx.amount < minAmount) {
                otherSentNodeValue += tx.amount;
            }

            if (tx.recipient === address && tx.amount < minAmount) {
                otherReceivedNodeValue += tx.amount;
            }
        });

        // Add "Other" nodes for sent and received if there were any transactions under the minAmount
        if (otherSentNodeValue > 0) {
            const otherSentNode = { name: "Other Sent", sent: otherSentNodeValue, received: 0 };
            nodes.push(otherSentNode);
            links.push({
                source: mainNodeIndex,
                target: nodes.indexOf(otherSentNode),
                value: otherSentNodeValue
            });
        }

        if (otherReceivedNodeValue > 0) {
            const otherReceivedNode = { name: "Other Received", sent: 0, received: otherReceivedNodeValue };
            nodes.push(otherReceivedNode);
            links.push({
                source: nodes.indexOf(otherReceivedNode),
                target: mainNodeIndex,
                value: otherReceivedNodeValue
            });
        }

        console.log("Nodes:", nodes);
        console.log("Links:", links);

        res.json({ nodes, links });
    } catch (error) {
        console.error('Failed to fetch data', error);
        res.status(500).send('Error fetching data');
    }
});

app.listen(5000, function () {
    console.log('Server listening on port 5000!')
});
