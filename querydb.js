import mongodb from 'mongodb';
import { decode as base32decode, encode as base32encode } from 'thirty-two';
import symbolSdk from 'symbol-sdk';

const { MongoClient } = mongodb;
const { Binary } = mongodb;

async function fetchData(client, address, depth, minAmount, mosaic, divisibility) {
  const facade = new symbolSdk.facade.SymbolFacade('mainnet');
  const divisor = 10 ** -divisibility;

  const collection = client.db('catapult').collection('transactions');

  const encodedAddresses = address.map(addr => {
    const buffer = base32decode(addr);
    console.log(`Encoded address ${addr}: ${buffer.toString('hex')}`);
    return new Binary(buffer);
  });

  console.log('Encoded Addresses:', encodedAddresses);

  const cursor = collection.find({ 'meta.addresses': { $in: encodedAddresses } });

  const txs = [];
  await cursor.forEach(doc => {
    // Check if mosaics is defined
    if (doc.transaction && doc.transaction.mosaics) {
      // Check if the mosaic ID matches the user-specified mosaic ID
      doc.transaction.mosaics.forEach(mosaicRes => {
        const mosaicId = mosaicRes.id.toString();
        console.log("mosaic:", mosaicId, mosaic.toString());

        if (mosaic.toString() === mosaicId) {
          const amount = mosaicRes.amount * divisor;

          const recipientBuffer = doc.transaction.recipientAddress.buffer;
          const recipient = base32encode(recipientBuffer).toString().slice(0, 39);

          const senderBuffer = doc.transaction.signerPublicKey.buffer;
          const sender = senderBuffer.toString('hex');

          const publicKey = new symbolSdk.PublicKey(sender);
          const senderAddress = facade.network.publicKeyToAddress(publicKey).toString();

          const hash = doc.meta.hash; // Fetch transaction hash from the metadata

          console.log("Recipient:", recipient);
          console.log("Sender:", senderAddress);
          console.log("Amount:", amount);
          console.log("Hash:", hash);

          txs.push({
            amount,
            recipient,
            sender: senderAddress,
            hash  // Include the transaction hash
          });
        }
      });
    }
  });

  console.log('Txs:', txs);
  return txs;
}


export default fetchData;
