/* ============================================================
   AgriChain — app.js
   Connects the page to the SupplyChain smart contract, handles
   product registration, stage updates, QR generation, and
   QR scanning for the customer-facing tracking view.
   ============================================================ */

// ---- 1. Paste your deployed contract address here ----
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";

// ---- 2. Contract ABI (matches SupplyChain.sol) ----
const CONTRACT_ABI = [
  "function registerProduct(string _cropName, string _farmerName, string _origin) public returns (uint256)",
  "function updateStage(uint256 _id, uint8 _stage, string _details) public",
  "function getProduct(uint256 _id) public view returns (uint256 id, string cropName, string farmerName, string origin, uint8 currentStage, address farmerAddress)",
  "function getHistoryLength(uint256 _id) public view returns (uint256)",
  "function getHistoryItem(uint256 _id, uint256 _index) public view returns (uint8 stage, string details, uint256 timestamp, address updatedBy)",
  "event ProductRegistered(uint256 indexed productId, string cropName, string farmerName, string origin, address indexed farmer)",
  "event StageUpdated(uint256 indexed productId, uint8 stage, string details, address indexed updatedBy)"
];

const STAGE_LABELS = [
  "Registered",
  "With distributor",
  "In warehouse",
  "In transport",
  "With retailer",
  "Delivered"
];

let provider, signer, contract;
let qrScanner = null;

// ---- Wallet connection ----
const connectBtn = document.getElementById("connect-btn");
const walletStatus = document.getElementById("wallet-status");

connectBtn.addEventListener("click", connectWallet);

async function connectWallet() {
  if (!window.ethereum) {
    walletStatus.textContent = "MetaMask not found — please install it.";
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const address = await signer.getAddress();
    walletStatus.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
    connectBtn.textContent = "Connected";
  } catch (err) {
    console.error(err);
    walletStatus.textContent = "Connection failed. See console for details.";
  }
}

function requireContract() {
  if (!contract) {
    alert("Please connect your wallet first.");
    return false;
  }
  return true;
}

// ---- Step 1: Register product ----
const registerForm = document.getElementById("register-form");
const registerResult = document.getElementById("register-result");
const newProductIdEl = document.getElementById("new-product-id");
const qrCodeDiv = document.getElementById("qr-code");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireContract()) return;

  const formData = new FormData(registerForm);
  const cropName = formData.get("cropName");
  const farmerName = formData.get("farmerName");
  const origin = formData.get("origin");

  const submitBtn = registerForm.querySelector("button");
  submitBtn.disabled = true;
  submitBtn.textContent = "Registering...";

  try {
    const tx = await contract.registerProduct(cropName, farmerName, origin);
    const receipt = await tx.wait();

    // Pull the new product ID out of the ProductRegistered event
    const event = receipt.logs
      .map((log) => {
        try { return contract.interface.parseLog(log); } catch { return null; }
      })
      .find((parsed) => parsed && parsed.name === "ProductRegistered");

    const productId = event.args.productId.toString();

    newProductIdEl.textContent = productId;
    registerResult.hidden = false;

    // Generate the QR code (encodes the product ID)
    qrCodeDiv.innerHTML = "";
    new QRCode(qrCodeDiv, {
      text: productId,
      width: 160,
      height: 160
    });

    registerForm.reset();
  } catch (err) {
    console.error(err);
    alert("Registration failed. See console for details.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Register on blockchain";
  }
});

// ---- Step 2: Update stage ----
const updateForm = document.getElementById("update-form");
const updateStatus = document.getElementById("update-status");

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireContract()) return;

  const formData = new FormData(updateForm);
  const productId = formData.get("productId");
  const stage = Number(formData.get("stage"));
  const details = formData.get("details");

  const submitBtn = updateForm.querySelector("button");
  submitBtn.disabled = true;
  submitBtn.textContent = "Recording...";
  updateStatus.hidden = true;

  try {
    const tx = await contract.updateStage(productId, stage, details);
    await tx.wait();

    updateStatus.textContent = `Product #${productId} updated to "${STAGE_LABELS[stage]}".`;
    updateStatus.classList.remove("error");
    updateStatus.hidden = false;
    updateForm.reset();
  } catch (err) {
    console.error(err);
    updateStatus.textContent = "Update failed — check the product ID and that the stage moves forward.";
    updateStatus.classList.add("error");
    updateStatus.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Record update";
  }
});

// ---- Step 3: Track product (manual entry) ----
const trackBtn = document.getElementById("track-btn");
const trackIdInput = document.getElementById("track-id-input");

trackBtn.addEventListener("click", () => {
  const id = trackIdInput.value;
  if (!id) {
    alert("Enter a product ID first.");
    return;
  }
  trackProduct(id);
});

async function trackProduct(productId) {
  if (!requireContract()) return;

  const journeyResult = document.getElementById("journey-result");
  const journeyTitle = document.getElementById("journey-title");
  const journeyStage = document.getElementById("journey-stage");
  const journeyMeta = document.getElementById("journey-meta");
  const journeyTimeline = document.getElementById("journey-timeline");

  try {
    const product = await contract.getProduct(productId);
    const [id, cropName, farmerName, origin, currentStage] = product;

    journeyTitle.textContent = `${cropName} — Product #${id}`;
    journeyStage.textContent = STAGE_LABELS[currentStage];
    journeyMeta.textContent = `Farmer: ${farmerName} | Origin: ${origin}`;

    const historyLength = await contract.getHistoryLength(productId);
    journeyTimeline.innerHTML = "";

    for (let i = 0; i < historyLength; i++) {
      const [stage, details, timestamp] = await contract.getHistoryItem(productId, i);
      const date = new Date(Number(timestamp) * 1000).toLocaleString();

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="t-stage">${STAGE_LABELS[stage]}</div>
        <div class="t-detail">${details}</div>
        <div class="t-time">${date}</div>
      `;
      journeyTimeline.appendChild(li);
    }

    journeyResult.hidden = false;
    journeyResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.error(err);
    alert("Could not find that product. Check the ID and try again.");
  }
}

// ---- Step 3b: Scan QR code with the camera ----
const scanBtn = document.getElementById("scan-btn");
const qrReaderDiv = document.getElementById("qr-reader");

scanBtn.addEventListener("click", () => {
  if (qrScanner) {
    stopScanner();
    return;
  }

  qrReaderDiv.hidden = false;
  scanBtn.textContent = "Stop scanning";

  qrScanner = new Html5Qrcode("qr-reader");
  qrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        trackIdInput.value = decodedText;
        stopScanner();
        trackProduct(decodedText);
      },
      () => { /* ignore per-frame scan errors */ }
    )
    .catch((err) => {
      console.error(err);
      alert("Could not access camera. Check permissions and try again.");
      stopScanner();
    });
});

function stopScanner() {
  if (qrScanner) {
    qrScanner.stop().then(() => {
      qrScanner.clear();
      qrScanner = null;
    }).catch(() => { qrScanner = null; });
  }
  qrReaderDiv.hidden = true;
  scanBtn.textContent = "Scan QR code";
}
