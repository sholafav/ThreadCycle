import { describe, it, expect, beforeEach } from "vitest";

interface NFT {
  owner: string;
  metadata: string;
}

interface LifecycleEvent {
  eventType: string;
  timestamp: bigint;
  details: string;
}

interface MockContract {
  admin: string;
  paused: boolean;
  totalNfts: bigint;
  provenanceContract: string | null;
  nfts: Map<bigint, NFT>;
  lifecycleEvents: Map<bigint, LifecycleEvent[]>;
  tokenCount: Map<string, bigint>;
  MAX_NFTS: bigint;

  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setProvenanceContract(caller: string, contract: string): { value: boolean } | { error: number };
  mint(caller: string, recipient: string, metadata: string): { value: bigint } | { error: number };
  transfer(caller: string, tokenId: bigint, recipient: string): { value: boolean } | { error: number };
  updateMetadata(caller: string, tokenId: bigint, metadata: string): { value: boolean } | { error: number };
  addLifecycleEvent(caller: string, tokenId: bigint, eventType: string, details: string): { value: boolean } | { error: number };
  burn(caller: string, tokenId: bigint): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalNfts: 0n,
  provenanceContract: null,
  nfts: new Map(),
  lifecycleEvents: new Map(),
  tokenCount: new Map(),
  MAX_NFTS: 1_000_000n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  setProvenanceContract(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.provenanceContract = contract;
    return { value: true };
  },

  mint(caller: string, recipient: string, metadata: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (metadata.length === 0 || metadata.length > 256) return { error: 106 };
    if (this.paused) return { error: 104 };
    const tokenId = this.totalNfts + 1n;
    if (tokenId > this.MAX_NFTS) return { error: 102 };
    this.nfts.set(tokenId, { owner: recipient, metadata });
    this.tokenCount.set(recipient, (this.tokenCount.get(recipient) || 0n) + 1n);
    this.totalNfts = tokenId;
    return { value: tokenId };
  },

  transfer(caller: string, tokenId: bigint, recipient: string) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    const nft = this.nfts.get(tokenId);
    if (!nft) return { error: 107 };
    if (nft.owner !== caller) return { error: 103 };
    this.nfts.set(tokenId, { owner: recipient, metadata: nft.metadata });
    this.tokenCount.set(caller, (this.tokenCount.get(caller) || 0n) - 1n);
    this.tokenCount.set(recipient, (this.tokenCount.get(recipient) || 0n) + 1n);
    return { value: true };
  },

  updateMetadata(caller: string, tokenId: bigint, metadata: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (metadata.length === 0 || metadata.length > 256) return { error: 106 };
    const nft = this.nfts.get(tokenId);
    if (!nft) return { error: 107 };
    this.nfts.set(tokenId, { owner: nft.owner, metadata });
    return { value: true };
  },

  addLifecycleEvent(caller: string, tokenId: bigint, eventType: string, details: string) {
    if (!this.provenanceContract || caller !== this.provenanceContract) return { error: 100 };
    if (!["production", "repair", "resale", "recycle", "donation"].includes(eventType)) return { error: 108 };
    if (details.length === 0 || details.length > 256) return { error: 106 };
    const nft = this.nfts.get(tokenId);
    if (!nft) return { error: 107 };
    const events = this.lifecycleEvents.get(tokenId) || [];
    if (events.length >= 50) return { error: 108 };
    events.push({ eventType, timestamp: BigInt(1000), details });
    this.lifecycleEvents.set(tokenId, events);
    return { value: true };
  },

  burn(caller: string, tokenId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const nft = this.nfts.get(tokenId);
    if (!nft) return { error: 107 };
    this.tokenCount.set(nft.owner, (this.tokenCount.get(nft.owner) || 0n) - 1n);
    this.nfts.delete(tokenId);
    this.lifecycleEvents.delete(tokenId);
    return { value: true };
  },
};

describe("ThreadCycle Garment NFT Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalNfts = 0n;
    mockContract.provenanceContract = null;
    mockContract.nfts = new Map();
    mockContract.lifecycleEvents = new Map();
    mockContract.tokenCount = new Map();
  });

  it("should mint a new NFT when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    expect(result).toEqual({ value: 1n });
    expect(mockContract.nfts.get(1n)).toEqual({ owner: "ST2CY5...", metadata: "Cotton, Made in Italy, 2025" });
    expect(mockContract.tokenCount.get("ST2CY5...")).toBe(1n);
    expect(mockContract.totalNfts).toBe(1n);
  });

  it("should prevent minting by non-admin", () => {
    const result = mockContract.mint("ST3NB...", "ST2CY5...", "Cotton, Made in Italy, 2025");
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent minting with invalid metadata", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", "");
    expect(result).toEqual({ error: 106 });
  });

  it("should prevent minting over max NFTs", () => {
    mockContract.totalNfts = mockContract.MAX_NFTS;
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    expect(result).toEqual({ error: 102 });
  });

  it("should transfer NFT to a new owner", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.transfer("ST2CY5...", 1n, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.get(1n)?.owner).toBe("ST3NB...");
    expect(mockContract.tokenCount.get("ST2CY5...")).toBe(0n);
    expect(mockContract.tokenCount.get("ST3NB...")).toBe(1n);
  });

  it("should prevent transfer by non-owner", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.transfer("ST3NB...", 1n, "ST4NB...");
    expect(result).toEqual({ error: 103 });
  });

  it("should prevent transfer when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.transfer("ST2CY5...", 1n, "ST3NB...");
    expect(result).toEqual({ error: 104 });
  });

  it("should update metadata when called by admin", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.updateMetadata(mockContract.admin, 1n, "Updated: Organic Cotton, 2025");
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.get(1n)?.metadata).toBe("Updated: Organic Cotton, 2025");
  });

  it("should add lifecycle event when called by provenance contract", () => {
    mockContract.setProvenanceContract(mockContract.admin, "ST5NB...");
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.addLifecycleEvent("ST5NB...", 1n, "production", "Produced in ethical factory");
    expect(result).toEqual({ value: true });
    expect(mockContract.lifecycleEvents.get(1n)?.[0]).toEqual({
      eventType: "production",
      timestamp: 1000n,
      details: "Produced in ethical factory",
    });
  });

  it("should prevent adding lifecycle event by non-provenance contract", () => {
    mockContract.setProvenanceContract(mockContract.admin, "ST5NB...");
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.addLifecycleEvent("ST6NB...", 1n, "production", "Produced in ethical factory");
    expect(result).toEqual({ error: 100 });
  });

  it("should burn NFT when called by admin", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.burn(mockContract.admin, 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.nfts.has(1n)).toBe(false);
    expect(mockContract.tokenCount.get("ST2CY5...")).toBe(0n);
  });

  it("should prevent burning by non-admin", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", "Cotton, Made in Italy, 2025");
    const result = mockContract.burn("ST3NB...", 1n);
    expect(result).toEqual({ error: 100 });
  });
});