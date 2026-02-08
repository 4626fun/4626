/**
 * CreatorShareHook — Anchor Integration Tests
 *
 * Tests the full instruction lifecycle using a local test validator:
 *   1. initializeCreator — creates CreatorConfig, PendingEntries, WinnerRecord PDAs
 *   2. initializeExtraAccountMetaList — creates the extra account meta list PDA
 *   3. Admin operations — updateConfig, addAmmProgram, removeAmmProgram, rotateKeeper
 *   4. drainEntries — keeper drains the pending entries buffer
 *   5. recordWinner — keeper records a lottery winner
 *   6. Authorization checks — unauthorized callers are rejected
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert, expect } from "chai";

// ============================================================================
// Constants matching the Rust program
// ============================================================================
const CREATOR_CONFIG_SEED = Buffer.from("creator_config");
const PENDING_ENTRIES_SEED = Buffer.from("pending_entries");
const WINNER_RECORD_SEED = Buffer.from("winner_record");
const EXTRA_ACCOUNT_META_LIST_SEED = Buffer.from("extra-account-metas");

const MAX_AMM_PROGRAMS = 8;

// ============================================================================
// Helpers
// ============================================================================
function derivePDAs(mint: PublicKey, programId: PublicKey) {
  const [creatorConfig, ccBump] = PublicKey.findProgramAddressSync(
    [CREATOR_CONFIG_SEED, mint.toBuffer()],
    programId
  );
  const [pendingEntries, peBump] = PublicKey.findProgramAddressSync(
    [PENDING_ENTRIES_SEED, mint.toBuffer()],
    programId
  );
  const [winnerRecord, wrBump] = PublicKey.findProgramAddressSync(
    [WINNER_RECORD_SEED, mint.toBuffer()],
    programId
  );
  const [extraAccountMetaList, eaBump] = PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_META_LIST_SEED, mint.toBuffer()],
    programId
  );
  return { creatorConfig, pendingEntries, winnerRecord, extraAccountMetaList };
}

describe("creator_share_hook", () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CreatorShareHook as Program;

  // Test keypairs
  const authority = provider.wallet.payer;
  const keeper = Keypair.generate();
  const fakeUser = Keypair.generate();
  const mint = Keypair.generate(); // Simulated Token-2022 mint (just a pubkey for PDA derivation)
  const ammProgram1 = Keypair.generate();
  const ammProgram2 = Keypair.generate();
  const ammProgram3 = Keypair.generate();

  let pdas: ReturnType<typeof derivePDAs>;

  before(async () => {
    pdas = derivePDAs(mint.publicKey, program.programId);

    // Airdrop SOL to the keeper and fakeUser for signing
    const airdropKeeper = await provider.connection.requestAirdrop(
      keeper.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropKeeper);

    const airdropFake = await provider.connection.requestAirdrop(
      fakeUser.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropFake);
  });

  // ========================================================================
  // initializeCreator
  // ========================================================================
  describe("initializeCreator", () => {
    it("initializes CreatorConfig, PendingEntries, and WinnerRecord PDAs", async () => {
      await program.methods
        .initializeCreator({
          keeperAuthority: keeper.publicKey,
          feeBps: 690,
          flushThreshold: new BN(1000),
          lotteryEnabled: true,
          knownAmmPrograms: [ammProgram1.publicKey],
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Verify CreatorConfig
      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.ok(
        config.creatorMint.equals(mint.publicKey),
        "creatorMint matches"
      );
      assert.ok(
        config.authority.equals(authority.publicKey),
        "authority matches"
      );
      assert.ok(
        config.keeperAuthority.equals(keeper.publicKey),
        "keeper matches"
      );
      assert.equal(config.feeBps, 690, "feeBps is 690");
      assert.equal(
        config.flushThreshold.toNumber(),
        1000,
        "flushThreshold is 1000"
      );
      assert.equal(config.lotteryEnabled, true, "lottery enabled");
      assert.equal(config.ammProgramCount, 1, "1 AMM program");

      // Verify PendingEntries
      const entries = await (program.account as any).pendingEntries.fetch(
        pdas.pendingEntries
      );
      assert.ok(
        entries.creatorMint.equals(mint.publicKey),
        "pending entries mint matches"
      );
      assert.equal(entries.count, 0, "no pending entries");
      assert.equal(entries.head, 0, "head at 0");
      assert.equal(
        entries.overflowCount.toNumber(),
        0,
        "no overflow"
      );

      // Verify WinnerRecord
      const winner = await (program.account as any).winnerRecord.fetch(
        pdas.winnerRecord
      );
      assert.ok(
        winner.creatorMint.equals(mint.publicKey),
        "winner record mint matches"
      );
      assert.ok(
        winner.winner.equals(PublicKey.default),
        "winner is default"
      );
      assert.equal(winner.sharesPaid.toNumber(), 0, "shares_paid is 0");
      assert.equal(winner.timestamp.toNumber(), 0, "timestamp is 0");
    });

    it("rejects duplicate initialization (same mint)", async () => {
      try {
        await program.methods
          .initializeCreator({
            keeperAuthority: keeper.publicKey,
            feeBps: 690,
            flushThreshold: new BN(0),
            lotteryEnabled: true,
            knownAmmPrograms: [],
          })
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        // PDA already in use
        assert.ok(
          e.message.includes("already in use") ||
            e.logs?.some((l: string) => l.includes("already in use")),
          "Expected 'already in use' error"
        );
      }
    });

    it("rejects fee_bps > 10000", async () => {
      const mint2 = Keypair.generate();
      try {
        await program.methods
          .initializeCreator({
            keeperAuthority: keeper.publicKey,
            feeBps: 10001,
            flushThreshold: new BN(0),
            lotteryEnabled: true,
            knownAmmPrograms: [],
          })
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown for fee_bps > 10000");
      } catch (e: any) {
        assert.ok(
          e.message.includes("InvalidFeeBps") ||
            e.logs?.some((l: string) => l.includes("InvalidFeeBps")),
          "Expected InvalidFeeBps error"
        );
      }
    });

    it("rejects more than MAX_AMM_PROGRAMS known AMMs", async () => {
      const mint3 = Keypair.generate();
      const tooManyAmms = Array.from({ length: MAX_AMM_PROGRAMS + 1 }, () =>
        Keypair.generate().publicKey
      );
      try {
        await program.methods
          .initializeCreator({
            keeperAuthority: keeper.publicKey,
            feeBps: 690,
            flushThreshold: new BN(0),
            lotteryEnabled: true,
            knownAmmPrograms: tooManyAmms,
          })
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown for too many AMMs");
      } catch (e: any) {
        assert.ok(
          e.message.includes("AmmListFull") ||
            e.logs?.some((l: string) => l.includes("AmmListFull")),
          "Expected AmmListFull error"
        );
      }
    });

    it("initializes with lottery disabled", async () => {
      const mint4 = Keypair.generate();
      await program.methods
        .initializeCreator({
          keeperAuthority: keeper.publicKey,
          feeBps: 100,
          flushThreshold: new BN(5000),
          lotteryEnabled: false,
          knownAmmPrograms: [],
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint4.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pdas4 = derivePDAs(mint4.publicKey, program.programId);
      const config = await (program.account as any).creatorConfig.fetch(
        pdas4.creatorConfig
      );
      assert.equal(config.lotteryEnabled, false, "lottery disabled");
      assert.equal(config.feeBps, 100, "custom fee_bps");
      assert.equal(config.ammProgramCount, 0, "no AMMs");
    });

    it("initializes with zero fee_bps and zero flush threshold", async () => {
      const mint5 = Keypair.generate();
      await program.methods
        .initializeCreator({
          keeperAuthority: keeper.publicKey,
          feeBps: 0,
          flushThreshold: new BN(0),
          lotteryEnabled: true,
          knownAmmPrograms: [],
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint5.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pdas5 = derivePDAs(mint5.publicKey, program.programId);
      const config = await (program.account as any).creatorConfig.fetch(
        pdas5.creatorConfig
      );
      assert.equal(config.feeBps, 0);
      assert.equal(config.flushThreshold.toNumber(), 0);
    });

    it("initializes with max valid fee_bps (10000)", async () => {
      const mint6 = Keypair.generate();
      await program.methods
        .initializeCreator({
          keeperAuthority: keeper.publicKey,
          feeBps: 10000,
          flushThreshold: new BN(0),
          lotteryEnabled: true,
          knownAmmPrograms: [],
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint6.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const pdas6 = derivePDAs(mint6.publicKey, program.programId);
      const config = await (program.account as any).creatorConfig.fetch(
        pdas6.creatorConfig
      );
      assert.equal(config.feeBps, 10000);
    });
  });

  // ========================================================================
  // Admin: updateConfig
  // ========================================================================
  describe("updateConfig", () => {
    it("updates fee_bps only", async () => {
      await program.methods
        .updateConfig({
          feeBps: 500,
          flushThreshold: null,
          lotteryEnabled: null,
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.feeBps, 500, "fee_bps updated to 500");
      assert.equal(
        config.flushThreshold.toNumber(),
        1000,
        "flushThreshold unchanged"
      );
      assert.equal(config.lotteryEnabled, true, "lottery unchanged");
    });

    it("updates flush_threshold only", async () => {
      await program.methods
        .updateConfig({
          feeBps: null,
          flushThreshold: new BN(5000),
          lotteryEnabled: null,
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.feeBps, 500, "fee_bps unchanged");
      assert.equal(
        config.flushThreshold.toNumber(),
        5000,
        "flushThreshold updated"
      );
    });

    it("updates lottery_enabled only", async () => {
      await program.methods
        .updateConfig({
          feeBps: null,
          flushThreshold: null,
          lotteryEnabled: false,
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.lotteryEnabled, false, "lottery disabled");

      // Re-enable for subsequent tests
      await program.methods
        .updateConfig({
          feeBps: null,
          flushThreshold: null,
          lotteryEnabled: true,
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();
    });

    it("updates all fields at once", async () => {
      await program.methods
        .updateConfig({
          feeBps: 690,
          flushThreshold: new BN(0),
          lotteryEnabled: true,
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.feeBps, 690);
      assert.equal(config.flushThreshold.toNumber(), 0);
      assert.equal(config.lotteryEnabled, true);
    });

    it("rejects fee_bps > 10000", async () => {
      try {
        await program.methods
          .updateConfig({
            feeBps: 10001,
            flushThreshold: null,
            lotteryEnabled: null,
          })
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("InvalidFeeBps") ||
            e.logs?.some((l: string) => l.includes("InvalidFeeBps")),
          "Expected InvalidFeeBps error"
        );
      }
    });

    it("rejects unauthorized authority", async () => {
      try {
        await program.methods
          .updateConfig({
            feeBps: 100,
            flushThreshold: null,
            lotteryEnabled: null,
          })
          .accounts({
            authority: fakeUser.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([fakeUser])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("UnauthorizedAuthority") ||
            e.message.includes("ConstraintRaw") ||
            e.message.includes("2001") ||
            e.logs?.some(
              (l: string) =>
                l.includes("UnauthorizedAuthority") ||
                l.includes("ConstraintRaw")
            ),
          "Expected UnauthorizedAuthority error"
        );
      }
    });
  });

  // ========================================================================
  // Admin: addAmmProgram / removeAmmProgram
  // ========================================================================
  describe("AMM program management", () => {
    it("adds a second AMM program", async () => {
      await program.methods
        .addAmmProgram(ammProgram2.publicKey)
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.ammProgramCount, 2, "2 AMM programs");
    });

    it("rejects duplicate AMM program", async () => {
      try {
        await program.methods
          .addAmmProgram(ammProgram1.publicKey) // already added in initializeCreator
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("AmmAlreadyExists") ||
            e.logs?.some((l: string) => l.includes("AmmAlreadyExists")),
          "Expected AmmAlreadyExists error"
        );
      }
    });

    it("removes an AMM program", async () => {
      await program.methods
        .removeAmmProgram(ammProgram1.publicKey)
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.equal(config.ammProgramCount, 1, "1 AMM program remaining");
    });

    it("rejects removing non-existent AMM", async () => {
      try {
        await program.methods
          .removeAmmProgram(ammProgram3.publicKey) // never added
          .accounts({
            authority: authority.publicKey,
            creatorMint: mint.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("AmmNotFound") ||
            e.logs?.some((l: string) => l.includes("AmmNotFound")),
          "Expected AmmNotFound error"
        );
      }
    });

    it("rejects add from unauthorized authority", async () => {
      try {
        await program.methods
          .addAmmProgram(ammProgram3.publicKey)
          .accounts({
            authority: fakeUser.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([fakeUser])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("Unauthorized") ||
            e.message.includes("Constraint") ||
            e.logs?.some(
              (l: string) =>
                l.includes("Unauthorized") || l.includes("Constraint")
            ),
          "Expected authorization error"
        );
      }
    });
  });

  // ========================================================================
  // Admin: rotateKeeper
  // ========================================================================
  describe("rotateKeeper", () => {
    const newKeeper = Keypair.generate();

    it("rotates the keeper authority", async () => {
      await program.methods
        .rotateKeeper(newKeeper.publicKey)
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.ok(
        config.keeperAuthority.equals(newKeeper.publicKey),
        "keeper rotated"
      );
    });

    it("rotates back to original keeper", async () => {
      await program.methods
        .rotateKeeper(keeper.publicKey)
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint.publicKey,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.ok(
        config.keeperAuthority.equals(keeper.publicKey),
        "keeper rotated back"
      );
    });

    it("rejects rotate from unauthorized authority", async () => {
      try {
        await program.methods
          .rotateKeeper(fakeUser.publicKey)
          .accounts({
            authority: fakeUser.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([fakeUser])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("Unauthorized") ||
            e.message.includes("Constraint") ||
            e.logs?.some(
              (l: string) =>
                l.includes("Unauthorized") || l.includes("Constraint")
            ),
          "Expected authorization error"
        );
      }
    });
  });

  // ========================================================================
  // drainEntries
  // ========================================================================
  describe("drainEntries", () => {
    it("rejects drain when buffer is empty", async () => {
      try {
        await program.methods
          .drainEntries()
          .accounts({
            keeper: keeper.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([keeper])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("NoPendingEntries") ||
            e.logs?.some((l: string) => l.includes("NoPendingEntries")),
          "Expected NoPendingEntries error"
        );
      }
    });

    it("rejects drain from unauthorized keeper", async () => {
      try {
        await program.methods
          .drainEntries()
          .accounts({
            keeper: fakeUser.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([fakeUser])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("UnauthorizedKeeper") ||
            e.message.includes("Constraint") ||
            e.logs?.some(
              (l: string) =>
                l.includes("UnauthorizedKeeper") || l.includes("Constraint")
            ),
          "Expected UnauthorizedKeeper error"
        );
      }
    });
  });

  // ========================================================================
  // recordWinner
  // ========================================================================
  describe("recordWinner", () => {
    const winnerPubkey = Keypair.generate().publicKey;
    const sharesPaid = new BN(50_000_000_000); // 50 tokens

    it("records a winner", async () => {
      await program.methods
        .recordWinner(winnerPubkey, sharesPaid)
        .accounts({
          keeper: keeper.publicKey,
          creatorMint: mint.publicKey,
        })
        .signers([keeper])
        .rpc();

      const record = await (program.account as any).winnerRecord.fetch(
        pdas.winnerRecord
      );
      assert.ok(record.winner.equals(winnerPubkey), "winner matches");
      assert.equal(
        record.sharesPaid.toNumber(),
        sharesPaid.toNumber(),
        "shares_paid matches"
      );
      assert.ok(record.timestamp.toNumber() > 0, "timestamp is set");
    });

    it("overwrites previous winner with new one", async () => {
      const newWinner = Keypair.generate().publicKey;
      const newShares = new BN(100_000_000_000);

      await program.methods
        .recordWinner(newWinner, newShares)
        .accounts({
          keeper: keeper.publicKey,
          creatorMint: mint.publicKey,
        })
        .signers([keeper])
        .rpc();

      const record = await (program.account as any).winnerRecord.fetch(
        pdas.winnerRecord
      );
      assert.ok(record.winner.equals(newWinner), "new winner set");
      assert.equal(
        record.sharesPaid.toNumber(),
        newShares.toNumber(),
        "new shares_paid"
      );
    });

    it("records winner with zero shares", async () => {
      const w = Keypair.generate().publicKey;
      await program.methods
        .recordWinner(w, new BN(0))
        .accounts({
          keeper: keeper.publicKey,
          creatorMint: mint.publicKey,
        })
        .signers([keeper])
        .rpc();

      const record = await (program.account as any).winnerRecord.fetch(
        pdas.winnerRecord
      );
      assert.ok(record.winner.equals(w), "winner with 0 shares");
      assert.equal(record.sharesPaid.toNumber(), 0, "zero shares");
    });

    it("rejects recordWinner from unauthorized keeper", async () => {
      try {
        await program.methods
          .recordWinner(winnerPubkey, sharesPaid)
          .accounts({
            keeper: fakeUser.publicKey,
            creatorMint: mint.publicKey,
          })
          .signers([fakeUser])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("UnauthorizedKeeper") ||
            e.message.includes("Constraint") ||
            e.logs?.some(
              (l: string) =>
                l.includes("UnauthorizedKeeper") || l.includes("Constraint")
            ),
          "Expected UnauthorizedKeeper error"
        );
      }
    });
  });

  // ========================================================================
  // Multiple creators (independent PDAs)
  // ========================================================================
  describe("multiple creators", () => {
    const mint2 = Keypair.generate();
    const keeper2 = Keypair.generate();
    let pdas2: ReturnType<typeof derivePDAs>;

    before(async () => {
      pdas2 = derivePDAs(mint2.publicKey, program.programId);

      const airdrop = await provider.connection.requestAirdrop(
        keeper2.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);
    });

    it("initializes a second creator independently", async () => {
      await program.methods
        .initializeCreator({
          keeperAuthority: keeper2.publicKey,
          feeBps: 300,
          flushThreshold: new BN(500),
          lotteryEnabled: false,
          knownAmmPrograms: [ammProgram1.publicKey, ammProgram3.publicKey],
        })
        .accounts({
          authority: authority.publicKey,
          creatorMint: mint2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const config = await (program.account as any).creatorConfig.fetch(
        pdas2.creatorConfig
      );
      assert.ok(config.creatorMint.equals(mint2.publicKey));
      assert.equal(config.feeBps, 300);
      assert.equal(config.lotteryEnabled, false);
      assert.equal(config.ammProgramCount, 2);

      // First creator's config is unchanged
      const config1 = await (program.account as any).creatorConfig.fetch(
        pdas.creatorConfig
      );
      assert.ok(config1.creatorMint.equals(mint.publicKey));
      assert.equal(config1.feeBps, 690);
      assert.equal(config1.lotteryEnabled, true);
    });

    it("second creator's keeper can record a winner without affecting first", async () => {
      const winner2 = Keypair.generate().publicKey;
      await program.methods
        .recordWinner(winner2, new BN(25_000_000_000))
        .accounts({
          keeper: keeper2.publicKey,
          creatorMint: mint2.publicKey,
        })
        .signers([keeper2])
        .rpc();

      // Verify second creator's winner
      const record2 = await (program.account as any).winnerRecord.fetch(
        pdas2.winnerRecord
      );
      assert.ok(record2.winner.equals(winner2));
      assert.equal(record2.sharesPaid.toNumber(), 25_000_000_000);

      // First creator's winner is unchanged (from previous test)
      const record1 = await (program.account as any).winnerRecord.fetch(
        pdas.winnerRecord
      );
      assert.ok(!record1.winner.equals(winner2), "First creator unaffected");
    });

    it("first creator's keeper cannot operate on second creator", async () => {
      try {
        await program.methods
          .recordWinner(Keypair.generate().publicKey, new BN(1))
          .accounts({
            keeper: keeper.publicKey, // keeper for mint1, not mint2
            creatorMint: mint2.publicKey,
          })
          .signers([keeper])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e: any) {
        assert.ok(
          e.message.includes("UnauthorizedKeeper") ||
            e.message.includes("Constraint") ||
            e.logs?.some(
              (l: string) =>
                l.includes("UnauthorizedKeeper") || l.includes("Constraint")
            ),
          "Expected authorization error"
        );
      }
    });
  });
});
