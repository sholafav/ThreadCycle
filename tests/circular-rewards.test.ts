import { describe, it, expect, beforeEach } from "vitest";

interface MockContract {
  admin: string;
  paused: boolean;
  totalSupply: bigint;
  provenanceContract: string | null;
  rewardPerAction: bigint;
  cooldownPeriod: bigint;
  balances: Map<string, bigint>;
  lastActionTimestamp: Map<string, bigint>;
  actionCount: Map<string, bigint>;
  MAX_SUPPLY: bigint;

  isAdmin(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setProvenanceContract(caller: string, contract: string): { value: boolean } | { error: number };
  setRewardPerAction(caller: string, amount: bigint): { value: boolean } | { error: number };
  setCooldownPeriod(caller: string, blocks: bigint): { value: boolean } | { error: number };
  mint(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  transfer(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  rewardAction(caller: string, user: string, actionType: string): { value: bigint } | { error: number };
  burn(caller: string, amount: bigint): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalSupply: 0n,
  provenanceContract: null,
  rewardPerAction: 1_000_000n,
  cooldownPeriod: 1440n,
  balances: new Map(),
  lastActionTimestamp: new Map(),
  actionCount: new Map(),
  MAX_SUPPLY: 1_000_000_000n,

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

  setRewardPerAction(caller: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (amount <= 0n) return { error: 106 };
    this.rewardPerAction = amount;
    return { value: true };
  },

  setCooldownPeriod(caller: string, blocks: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (blocks <= 0n) return { error: 106 };
    this.cooldownPeriod = blocks;
    return { value: true };
  },

  mint(caller: string, recipient: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 106 };
    if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 108 };
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.totalSupply += amount;
    return { value: true };
  },

  transfer(caller: string, recipient: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 106 };
    const senderBalance = this.balances.get(caller) || 0n;
    if (senderBalance < amount) return { error: 101 };
    this.balances.set(caller, senderBalance - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    return { value: true };
  },

  rewardAction(caller: string, user: string, actionType: string) {
    if (!this.provenanceContract) return { error: 110 };
    if (caller !== this.provenanceContract) return { error: 100 };
    if (!["recycle", "resale", "donation", "repair"].includes(actionType)) return { error: 107 };
    if ((this.lastActionTimestamp.get(user) || 0n) + this.cooldownPeriod > 1000n) return { error: 109 };
    if (this.paused) return { error: 104 };
    const rewardAmount = this.rewardPerAction;
    if (this.totalSupply + rewardAmount > this.MAX_SUPPLY) return { error: 108 };
    this.balances.set(user, (this.balances.get(user) || 0n) + rewardAmount);
    this.lastActionTimestamp.set(user, 1000n);
    this.actionCount.set(user, (this.actionCount.get(user) || 0n) + 1n);
    this.totalSupply += rewardAmount;
    return { value: rewardAmount };
  },

  burn(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 106 };
    const balance = this.balances.get(caller) || 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.totalSupply -= amount;
    return { value: true };
  },
};

describe("ThreadCycle Circular Rewards Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalSupply = 0n;
    mockContract.provenanceContract = null;
    mockContract.rewardPerAction = 1_000_000n;
    mockContract.cooldownPeriod = 1440n;
    mockContract.balances = new Map();
    mockContract.lastActionTimestamp = new Map();
    mockContract.actionCount = new Map();
  });

  it("should mint tokens when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 1_000_000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(1_000_000n);
    expect(mockContract.totalSupply).toBe(1_000_000n);
  });

  it("should prevent minting by non-admin", () => {
    const result = mockContract.mint("ST3NB...", "ST2CY5...", 1_000_000n);
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent minting with zero amount", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 0n);
    expect(result).toEqual({ error: 106 });
  });

  it("should prevent minting over max supply", () => {
    mockContract.totalSupply = mockContract.MAX_SUPPLY;
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 1_000_000n);
    expect(result).toEqual({ error: 108 });
  });

  it("should transfer tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 2_000_000n);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 1_000_000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(1_000_000n);
    expect(mockContract.balances.get("ST3NB...")).toBe(1_000_000n);
  });

  it("should prevent transfer when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.mint(mockContract.admin, "ST2CY5...", 2_000_000n);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 1_000_000n);
    expect(result).toEqual({ error: 104 });
  });

  it("should prevent transfer with insufficient balance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500_000n);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 1_000_000n);
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent reward by non-provenance contract", () => {
    mockContract.setProvenanceContract(mockContract.admin, "ST5NB...");
    const result = mockContract.rewardAction("ST6NB...", "ST2CY5...", "recycle");
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent reward with invalid action type", () => {
    mockContract.setProvenanceContract(mockContract.admin, "ST5NB...");
    const result = mockContract.rewardAction("ST5NB...", "ST2CY5...", "invalid");
    expect(result).toEqual({ error: 107 });
  });

  it("should prevent reward during cooldown", () => {
    mockContract.setProvenanceContract(mockContract.admin, "ST5NB...");
    mockContract.rewardAction("ST5NB...", "ST2CY5...", "recycle");
    const result = mockContract.rewardAction("ST5NB...", "ST2CY5...", "recycle");
    expect(result).toEqual({ error: 109 });
  });

  it("should burn tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 2_000_000n);
    const result = mockContract.burn("ST2CY5...", 1_000_000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(1_000_000n);
    expect(mockContract.totalSupply).toBe(1_000_000n);
  });

  it("should prevent burning with insufficient balance", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 500_000n);
    const result = mockContract.burn("ST2CY5...", 1_000_000n);
    expect(result).toEqual({ error: 101 });
  });
});