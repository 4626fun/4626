# AmoePlonkVerifier
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/zk/AmoePlonkVerifier.sol)


## Constants
### w1

```solidity
uint256 constant w1 = 20402931748843538985151001264530049874871572933694634836567070693966133783803
```


### q

```solidity
uint256 constant q = 21888242871839275222246405745257275088548364400416034343698204186575808495617
```


### qf

```solidity
uint256 constant qf = 21888242871839275222246405745257275088696311157297823662689037894645226208583
```


### G1x

```solidity
uint256 constant G1x = 1
```


### G1y

```solidity
uint256 constant G1y = 2
```


### G2x1

```solidity
uint256 constant G2x1 = 10857046999023057135944570762232829481370756359578518086990519993285655852781
```


### G2x2

```solidity
uint256 constant G2x2 = 11559732032986387107991004021392285783925812861821192530917403151452391805634
```


### G2y1

```solidity
uint256 constant G2y1 = 8495653923123431417604973247489272438418190587263600148770280649306958101930
```


### G2y2

```solidity
uint256 constant G2y2 = 4082367875863433681332203403145435568316851327593401208105741076214120093531
```


### n

```solidity
uint32 constant n = 32768
```


### nPublic

```solidity
uint16 constant nPublic = 8
```


### nLagrange

```solidity
uint16 constant nLagrange = 8
```


### Qmx

```solidity
uint256 constant Qmx = 21309019613166260886311456675601480895608261919536662997632522065834735941044
```


### Qmy

```solidity
uint256 constant Qmy = 5444603791599110271192586369590134880900696672687678936325469175637794200353
```


### Qlx

```solidity
uint256 constant Qlx = 18993921226340323689893719547622399970523156120829083161463815886633741110555
```


### Qly

```solidity
uint256 constant Qly = 310286637152588899259863780499459687773170456866692459494967289116198374066
```


### Qrx

```solidity
uint256 constant Qrx = 7860079629867551397401158606255038016972836591108690919379614881370012487208
```


### Qry

```solidity
uint256 constant Qry = 14168289695398647810369414951672856883322807713532534319826865062262425664820
```


### Qox

```solidity
uint256 constant Qox = 17280211486518888886132425170138381874423064517988035754675520350457845592124
```


### Qoy

```solidity
uint256 constant Qoy = 15886739862815150413097562111640565281402402213675024488421266538259041070661
```


### Qcx

```solidity
uint256 constant Qcx = 17536447071381201065985234401452199052385051560159292227280798376531951899869
```


### Qcy

```solidity
uint256 constant Qcy = 18385785027978679027237865034025580191737281000136867589251279514534626217811
```


### S1x

```solidity
uint256 constant S1x = 19037028325391727417912666507149949692497761771104532186990360957516681785511
```


### S1y

```solidity
uint256 constant S1y = 20299421769833664504627623935027819545139207259002417177038300956584781414024
```


### S2x

```solidity
uint256 constant S2x = 21256495305375324199527778991464703968027542948575207544522963106196390021119
```


### S2y

```solidity
uint256 constant S2y = 20254249095512585866520031556554358499117235603356550279418267775280879983959
```


### S3x

```solidity
uint256 constant S3x = 8336096346147125460704636795969038352862434960268433858266682106136226199633
```


### S3y

```solidity
uint256 constant S3y = 6462330266542228389515474899447083066288514950666697870228445878071119801308
```


### k1

```solidity
uint256 constant k1 = 2
```


### k2

```solidity
uint256 constant k2 = 3
```


### X2x1

```solidity
uint256 constant X2x1 = 21831381940315734285607113342023901060522397560371972897001948545212302161822
```


### X2x2

```solidity
uint256 constant X2x2 = 17231025384763736816414546592865244497437017442647097510447326538965263639101
```


### X2y1

```solidity
uint256 constant X2y1 = 2388026358213174446665280700919698872609886601280537296205114254867301080648
```


### X2y2

```solidity
uint256 constant X2y2 = 11507326595632554467052522095592665270651932854513688777769618397986436103170
```


### pA

```solidity
uint16 constant pA = 4 + 0
```


### pB

```solidity
uint16 constant pB = 4 + 64
```


### pC

```solidity
uint16 constant pC = 4 + 128
```


### pZ

```solidity
uint16 constant pZ = 4 + 192
```


### pT1

```solidity
uint16 constant pT1 = 4 + 256
```


### pT2

```solidity
uint16 constant pT2 = 4 + 320
```


### pT3

```solidity
uint16 constant pT3 = 4 + 384
```


### pWxi

```solidity
uint16 constant pWxi = 4 + 448
```


### pWxiw

```solidity
uint16 constant pWxiw = 4 + 512
```


### pEval_a

```solidity
uint16 constant pEval_a = 4 + 576
```


### pEval_b

```solidity
uint16 constant pEval_b = 4 + 608
```


### pEval_c

```solidity
uint16 constant pEval_c = 4 + 640
```


### pEval_s1

```solidity
uint16 constant pEval_s1 = 4 + 672
```


### pEval_s2

```solidity
uint16 constant pEval_s2 = 4 + 704
```


### pEval_zw

```solidity
uint16 constant pEval_zw = 4 + 736
```


### pAlpha

```solidity
uint16 constant pAlpha = 0
```


### pBeta

```solidity
uint16 constant pBeta = 32
```


### pGamma

```solidity
uint16 constant pGamma = 64
```


### pXi

```solidity
uint16 constant pXi = 96
```


### pXin

```solidity
uint16 constant pXin = 128
```


### pBetaXi

```solidity
uint16 constant pBetaXi = 160
```


### pV1

```solidity
uint16 constant pV1 = 192
```


### pV2

```solidity
uint16 constant pV2 = 224
```


### pV3

```solidity
uint16 constant pV3 = 256
```


### pV4

```solidity
uint16 constant pV4 = 288
```


### pV5

```solidity
uint16 constant pV5 = 320
```


### pU

```solidity
uint16 constant pU = 352
```


### pPI

```solidity
uint16 constant pPI = 384
```


### pEval_r0

```solidity
uint16 constant pEval_r0 = 416
```


### pD

```solidity
uint16 constant pD = 448
```


### pF

```solidity
uint16 constant pF = 512
```


### pE

```solidity
uint16 constant pE = 576
```


### pTmp

```solidity
uint16 constant pTmp = 640
```


### pAlpha2

```solidity
uint16 constant pAlpha2 = 704
```


### pZh

```solidity
uint16 constant pZh = 736
```


### pZhInv

```solidity
uint16 constant pZhInv = 768
```


### pEval_l1

```solidity
uint16 constant pEval_l1 = 800
```


### pEval_l2

```solidity
uint16 constant pEval_l2 = 832
```


### pEval_l3

```solidity
uint16 constant pEval_l3 = 864
```


### pEval_l4

```solidity
uint16 constant pEval_l4 = 896
```


### pEval_l5

```solidity
uint16 constant pEval_l5 = 928
```


### pEval_l6

```solidity
uint16 constant pEval_l6 = 960
```


### pEval_l7

```solidity
uint16 constant pEval_l7 = 992
```


### pEval_l8

```solidity
uint16 constant pEval_l8 = 1024
```


### lastMem

```solidity
uint16 constant lastMem = 1056
```


## Functions
### verifyProof


```solidity
function verifyProof(uint256[24] calldata _proof, uint256[8] calldata _pubSignals) public view returns (bool);
```

