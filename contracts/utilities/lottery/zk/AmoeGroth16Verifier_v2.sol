// SPDX-License-Identifier: GPL-3.0
//
//                  ╭─────────────────────────────────────────────╮
//                  │  AmoeGroth16Verifier_v2 — TESTNET BUILD      │
//                  ╰─────────────────────────────────────────────╯
//
// This contract was emitted by `snarkjs zkey export solidityverifier` from
// a TESTNET-ONLY phase-2 trusted-setup ceremony recorded in
//   `circuits/amoe/ceremony/v2/CEREMONY_RUN_TESTNET.md`.
//
// Trust assumption summary:
//   - Phase-1: Hermez community ceremony (175+ contributors, well-established).
//   - Phase-2: 1 contributor (Perplexity Computer agent in a cloud sandbox).
//              ⚠ NOT INDEPENDENT — single-operator ceremonies are
//              flagged testnet-only by `circuits/amoe/CEREMONY.md`.
//   - Beacon: Bitcoin block 947011 (post-hoc selection — also non-mainnet-grade).
//
// Use for:  testnet deployments, integration tests, end-to-end relayer wiring.
// DO NOT USE FOR MAINNET.  Re-run the ceremony with ≥2 independent
// contributors and a pre-committed Bitcoin block before mainnet, then
// replace this file with the mainnet-grade verifier.
//
// Public-input layout (uint[8] _pubSignals) matches IAmoeGroth16Verifier:
//   [0] walletAddrCommit
//   [1] creatorCoinAddr
//   [2] nonceCommit
//   [3] epoch
//   [4] allowlistRoot
//   [5] pointsBurnedAsUSD       (v2)
//   [6] pointsLedgerRoot        (v2)
//   [7] pointsBurnNullifier     (v2)
//
// Original snarkJS notice follows.
// -------------------------------------------------------------------------

/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract AmoeGroth16Verifier_v2 {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 14377409704846291048915518228671296880545650207347825287653357899892652802456;
    uint256 constant deltax2 = 20973054882538065505493738925572524231796537595578694322519949777557035133072;
    uint256 constant deltay1 = 11662070744648972022672694734599226073140898275683693167030973331449644629087;
    uint256 constant deltay2 = 17855563339736091622609353054185917239301806607598133003191134711285299391901;

    
    uint256 constant IC0x = 17317949232810424004845238899123832162471429522118177793779996499224072200542;
    uint256 constant IC0y = 16380525655987898857980373564578447947016921047547684780041695036620253472336;
    
    uint256 constant IC1x = 15502394331481530005521661409384037761434324871632414369501112875948323082357;
    uint256 constant IC1y = 19408923977267625230432986375140505291048134861102167234105754992679510793713;
    
    uint256 constant IC2x = 18455035290635367414932515392895781969936448090085927542228457798999775856993;
    uint256 constant IC2y = 1862331534158606244844294422426254549267452324426890300766053696948515821789;
    
    uint256 constant IC3x = 1582084534197690482450236421757367538078756517071199897913642315571043575578;
    uint256 constant IC3y = 13982467317287256942498640295231551357333384962830749470685043060027279276936;
    
    uint256 constant IC4x = 3605242670272506719291397429117200099517405835671519504527978007775221365250;
    uint256 constant IC4y = 2301100015066400750604553727389204593571301619915068944585680384370407786999;
    
    uint256 constant IC5x = 12762902096465831436712213452689652776844689255827361964216444556842898508165;
    uint256 constant IC5y = 2169561211059971606551037520099052936048197524288758380891445825014089714162;
    
    uint256 constant IC6x = 16007336391210978043149121587567589434684031907788181015750882502745655133661;
    uint256 constant IC6y = 10308239779374695180957949847129503359342112604068207148708678967245143801114;
    
    uint256 constant IC7x = 9624905727531988377763959054429793208468605845298415993727293529699822684105;
    uint256 constant IC7y = 34458698801679987201819737187369605569301350130384904247253341082418275928;
    
    uint256 constant IC8x = 19069269136935780549074558884537851753785047471723348821220651973678821847585;
    uint256 constant IC8y = 8041603105747813903935117593421903346909759180348042279770131353188747146299;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[8] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
