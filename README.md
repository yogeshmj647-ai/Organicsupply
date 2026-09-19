# AgriChain — Farm to Customer Traceability

A working demo: farmers register crops on a blockchain smart contract, each supply-chain stage (distributor → warehouse → transport → retailer) logs its handoff, a QR code is generated per product, and customers scan it to see the full journey.

## Files

```
AgriChain/
├── index.html        — the web app (registration, updates, tracking, QR scan)
├── style.css          — styling
├── app.js             — wallet connection, contract calls, QR generate/scan logic
└── SupplyChain.sol    — the smart contract
```

No build tools, no npm install — everything runs directly in the browser.

## Step 1 — Deploy the smart contract (Remix)

1. Go to [remix.ethereum.org](https://remix.ethereum.org)
2. Create a new file `SupplyChain.sol` and paste in the contract from this folder
3. In the **Solidity Compiler** tab, select compiler version **0.8.20** or newer, and click **Compile**
4. In the **Deploy & Run Transactions** tab:
   - Set **Environment** to **Injected Provider – MetaMask**
   - Make sure MetaMask is connected to a test network (e.g. Polygon Amoy, or Sepolia)
   - Click **Deploy** and confirm the transaction in MetaMask
5. Once deployed, copy the **contract address** shown under "Deployed Contracts"

> Need test tokens? Search "Polygon Amoy faucet" or "Sepolia faucet" for a free test-token source for your chosen network.

## Step 2 — Add your contract address

Open `app.js` and find this line near the top:

```js
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
```

Replace it with your real deployed address:

```js
const CONTRACT_ADDRESS = "0x1234...your-address...";
```

## Step 3 — Run the site locally

1. Open the `AgriChain` folder in VS Code
2. Install the **Live Server** extension if you don't have it
3. Right-click `index.html` → **Open with Live Server**
4. The site opens in your browser — click **Connect wallet** and approve in MetaMask

## Step 4 — Demo the full flow

Use this walkthrough for a presentation:

| Step | Who | What to enter |
|---|---|---|
| Register | Farmer | Crop: `Rice`, Farmer: `Ravi`, Origin: `Tamil Nadu` |
| Update → With distributor | Distributor | Product ID: `1`, Details: `ABC Distributors` |
| Update → In warehouse | Warehouse | Product ID: `1`, Details: `Chennai warehouse` |
| Update → In transport | Transport | Product ID: `1`, Details: `En route to retailer` |
| Update → With retailer | Retailer | Product ID: `1`, Details: `XYZ Supermarket` |
| Update → Delivered | Retailer | Product ID: `1`, Details: `Sold to customer` |
| Track | Customer | Scan the QR code generated at registration, or enter `1` manually |

Each update requires MetaMask to sign a transaction — that's the point being demonstrated: every handoff is a recorded, verifiable event on the blockchain, not just a database row someone could quietly edit.

## How the QR flow works

- When a product is registered, `app.js` generates a QR code encoding the **product ID** using the `qrcode.js` library, shown right on the page for you to screenshot or print
- The **Scan QR code** button in the tracking section opens your device camera (via `html5-qrcode`) and automatically looks up whatever ID it scans

## Notes for your presentation

- This is a **demo / teaching build** — the contract has no access control (anyone can update any product's stage), which keeps it simple to demo but wouldn't be production-ready. A real deployment would restrict `updateStage` to verified addresses per role (e.g. only the assigned distributor can mark "with distributor").
- Stages can only move **forward** (the contract enforces this) — this mirrors how a real supply chain can't un-happen a step.
- Works on any EVM test network (Polygon Amoy, Sepolia, etc.) — just make sure MetaMask is on the same network you deployed to.
