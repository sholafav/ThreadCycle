# ThreadCycle

A blockchain-powered platform for sustainable fashion, enabling transparent tracking of second-hand and upcycled clothing lifecycles, rewarding eco-conscious consumers, and ensuring fair compensation for sustainable brands and artisans — all on-chain.

---

## Overview

ThreadCycle addresses the lack of transparency in fashion supply chains and the under-incentivized circular economy by using Web3 to track garment lifecycles, reward sustainable consumer behavior, and empower ethical brands. Built on the Stacks blockchain with Clarity smart contracts, it ensures immutable provenance, fair revenue distribution, and decentralized governance.

The platform consists of five main smart contracts:

1. **Garment NFT Contract** – Mints NFTs representing physical garments with lifecycle data.
2. **Circular Rewards Contract** – Rewards consumers for sustainable actions like recycling or reselling.
3. **Revenue Split Contract** – Distributes resale or rental profits among brands, artisans, and consumers.
4. **Provenance Tracking Contract** – Records and verifies garment lifecycle events (e.g., production, resale, repair).
5. **Governance DAO Contract** – Enables community voting on platform rules and sustainability initiatives.

---

## Features

- **Garment NFTs** with embedded lifecycle data (material sourcing, production, repairs, resales)  
- **Eco-rewards system** for recycling, donating, or reselling garments  
- **Automated profit sharing** for second-hand sales or rentals  
- **Transparent supply chain tracking** via immutable blockchain records  
- **Decentralized governance** for platform upgrades and sustainability standards  
- **Consumer incentives** to promote circular economy practices  

---

## Smart Contracts

### Garment NFT Contract
- Mints NFTs tied to physical garments  
- Stores metadata (e.g., materials, production date, artisan details)  
- Updates NFT metadata with lifecycle events via Provenance Tracking Contract  

### Circular Rewards Contract
- Tracks sustainable actions (e.g., recycling, reselling, donating) via oracle or manual verification  
- Distributes platform-native tokens to eco-conscious users  
- Anti-fraud mechanisms to prevent reward abuse  

### Revenue Split Contract
- Automates profit distribution from resales or rentals  
- Splits revenue among brands, artisans, and consumers based on predefined percentages  
- Transparent payout logs on-chain  

### Provenance Tracking Contract
- Records garment lifecycle events (e.g., production, repair, resale)  
- Integrates with oracles for real-world verification (e.g., recycling center confirmations)  
- Ensures immutable, auditable supply chain data  

### Governance DAO Contract
- Enables token-weighted voting on platform policies (e.g., reward rates, sustainability criteria)  
- Manages proposals for platform upgrades or partnerships  
- Enforces quorum and voting periods for fair governance  

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)  
2. Clone this repository:  
   ```bash
   git clone https://github.com/yourusername/threadcycle.git
   ```  
3. Run tests:  
   ```bash
   npm test
   ```  
4. Deploy contracts:  
   ```bash
   clarinet deploy
   ```

## Usage

Each smart contract operates independently but integrates with others for a complete sustainable fashion ecosystem. Refer to individual contract documentation for function calls, parameters, and usage examples.

## License

MIT License