#!/usr/bin/env tsx

import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

const FRIEND_KEY = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const FRIEND_KEY_IMPLEMENTATION = getAddress(
  "0x0b50bf9b7774e5049d7e85f4fe44fcb46a1109f1",
);
const AKITA_CREATOR_COIN = getAddress(
  "0x5b674196812451B7cEC024FE9d22D2c0b172fa75",
);
const AKITA_CREATOR_COIN_IMPLEMENTATION = getAddress(
  "0x88cc4e08c7608723f3e44e17ac669fb43b6a8313",
);
const SUDOSWAP_FACTORY = getAddress(
  "0x605145D263482684590f630E9e581B21E4938eb8",
);
const SUDOSWAP_XYK_CURVE = getAddress(
  "0xd0A2f4ae5E816ec09374c67F6532063B60dE037B",
);
const SUDOSWAP_VERY_FAST_ROUTER = getAddress(
  "0xa07eBD56b361Fe79AF706A2bF6d8097091225548",
);
const SUDOSWAP_ERC721_ETH_TEMPLATE = getAddress(
  "0xa43D2f748e73431983578a92ECD2D830126d5F17",
);
const SUDOSWAP_ERC721_ERC20_TEMPLATE = getAddress(
  "0x37Af63b1C64bC93e48Da17Cc018eD2B5F63802de",
);
const SUDOSWAP_ERC1155_ETH_TEMPLATE = getAddress(
  "0x2286e66cc3b3f15aE6d88164F618F98f1Ce21581",
);
const SUDOSWAP_ERC1155_ERC20_TEMPLATE = getAddress(
  "0x705fd2868348dF3Ea3f560E52B00c4C3df6AeEd2",
);
const ROOM_TOKEN_ID = 1659n;
const ROOM_TYPE = 0;
const ROOM_TIER = 1;
const ROOM_CREATOR = getAddress("0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9");
const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;

const PINNED_CODE: readonly {
  name: string;
  address: Address;
  bytes: number;
  codehash: Hex;
}[] = [
  {
    name: "Permit2",
    address: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
    bytes: 9_152,
    codehash:
      "0xa67739abc3ede9dbdc0491636c67d6a14ac07fab9030c3f509b1eb7b11dff8ed",
  },
  {
    name: "WETH9",
    address: getAddress("0x4200000000000000000000000000000000000006"),
    bytes: 2_041,
    codehash:
      "0x8a3a1f6a9f9dce633117adee5b458245835a8645a8c8726a26382a4622508b1c",
  },
  {
    name: "UniswapV2Factory",
    address: getAddress("0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"),
    bytes: 13_859,
    codehash:
      "0xbab145d02e7005f0d84c6c1639d39b799b0ea16df99ebbdaf5a14d9da820b4e0",
  },
  {
    name: "UniswapV3Factory",
    address: getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD"),
    bytes: 24_535,
    codehash:
      "0x95707a4ac71f20181a63ef7d180e3c625be5d20fc8f6f980befa966bad568132",
  },
  {
    name: "UniswapV4PoolManager",
    address: getAddress("0x498581fF718922c3f8e6A244956aF099B2652b2b"),
    bytes: 24_009,
    codehash:
      "0x83b2af6e9f3158defc2811cbcb0db71ecf8b2ba2abea39c39e370ac5c6f43eb6",
  },
  {
    name: "UniswapV3PositionManager",
    address: getAddress("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"),
    bytes: 24_384,
    codehash:
      "0x9177a11768996e8f951e0f0013d7165134178b15b21fb9916108f995e6c564bf",
  },
  {
    name: "UniswapV4PositionManager",
    address: getAddress("0x7C5f5A4bBd8fD63184577525326123B519429bDc"),
    bytes: 23_877,
    codehash:
      "0x243f9e091ddf11c7c04e28059fdbbf1bab82b72d414fafb8e096c097aaeb622a",
  },
  {
    name: "AcrossSpokePool",
    address: getAddress("0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64"),
    bytes: 680,
    codehash:
      "0x932cddc50793da935ccf915651ad67f6b746e9936fcc5614f0ff492563782c75",
  },
  {
    name: "FriendKeyProxy",
    address: FRIEND_KEY,
    bytes: 130,
    codehash:
      "0x822e29b945d91ba7b7d147af1d071e06ba7a22db742644ee18837c523b713c27",
  },
  {
    name: "FriendKeyImplementation",
    address: FRIEND_KEY_IMPLEMENTATION,
    bytes: 24_173,
    codehash:
      "0x7bb81ce6ec9a3af2bd158c29d6d257c2bae20c05e8dada54baa2973d9d6581f5",
  },
  {
    name: "AkitaCreatorCoinProxy",
    address: AKITA_CREATOR_COIN,
    bytes: 45,
    codehash:
      "0x491ee5ff073945eba77bfd15fb3b5ba11d6ffaf2c61846f56d82567ec5a2e418",
  },
  {
    name: "AkitaCreatorCoinImplementation",
    address: AKITA_CREATOR_COIN_IMPLEMENTATION,
    bytes: 19_049,
    codehash:
      "0xb9279e892b738c3efc35b27eb7470482d90340cf5e27e90220305de64c2fc593",
  },
  {
    name: "ManifoldRoyaltyRegistry",
    address: getAddress("0x3D1151dc590ebF5C04501a7d4E1f8921546774eA"),
    bytes: 2_542,
    codehash:
      "0x3abedc2e305cd03c671573339996ac6da8d148bb1d11a90e8d779fb7c13a8f81",
  },
  {
    name: "SudoswapV2Factory",
    address: SUDOSWAP_FACTORY,
    bytes: 20_184,
    codehash:
      "0x8c92513303611384df5cd4cb7a0a02489072d87a88ea4a2c4086937967c1d607",
  },
  {
    name: "SudoswapVeryFastRouter",
    address: SUDOSWAP_VERY_FAST_ROUTER,
    bytes: 16_484,
    codehash:
      "0xaf7603721e1b5cc3c23e365392b8c2c91369535a8bc81f6cb45ec5c2995de337",
  },
  {
    name: "SudoswapXykCurve",
    address: SUDOSWAP_XYK_CURVE,
    bytes: 1_326,
    codehash:
      "0x5dea58360692f2f5aa10d30d15048a468e394170d1dd4fa5ff8243be76fee9b5",
  },
  {
    name: "SudoswapERC721ETHTemplate",
    address: SUDOSWAP_ERC721_ETH_TEMPLATE,
    bytes: 22_591,
    codehash:
      "0x93999f003ecd0610620b5056de08cd499c83269e27bda49c25827d9bb741ec6e",
  },
  {
    name: "SudoswapERC721ERC20Template",
    address: SUDOSWAP_ERC721_ERC20_TEMPLATE,
    bytes: 23_970,
    codehash:
      "0x631b663db771d1417ca6b333c01b8fad99c737cc350adf8dccc3b209d9d3ef57",
  },
  {
    name: "SudoswapERC1155ETHTemplate",
    address: SUDOSWAP_ERC1155_ETH_TEMPLATE,
    bytes: 21_394,
    codehash:
      "0x5ded670539fdd7db8e969fb30b123e5096141bd5522502a09da4b484b5548b61",
  },
  {
    name: "SudoswapERC1155ERC20Template",
    address: SUDOSWAP_ERC1155_ERC20_TEMPLATE,
    bytes: 22_722,
    codehash:
      "0xd7cc28e25952b997000bf36110e42744a6aed2737e17ffcc948417ef27806836",
  },
];

const SUDOSWAP_FACTORY_ABI = parseAbi([
  "function owner() view returns (address)",
  "function protocolFeeMultiplier() view returns (uint256)",
  "function bondingCurveAllowed(address curve) view returns (bool)",
  "function routerStatus(address router) view returns (bool allowed, bool wasEverTouched)",
  "function erc721ETHTemplate() view returns (address)",
  "function erc721ERC20Template() view returns (address)",
  "function erc1155ETHTemplate() view returns (address)",
  "function erc1155ERC20Template() view returns (address)",
]);
const SUDOSWAP_ROUTER_ABI = parseAbi([
  "function factory() view returns (address)",
]);

const FRIEND_KEY_ABI = parseAbi([
  "function roomTypes(uint256 tokenId) view returns (uint8)",
  "function roomTiers(uint256 tokenId) view returns (uint8)",
  "function creatorByTokenId(uint256 tokenId) view returns (address)",
  "function totalSupply(uint256 tokenId) view returns (uint256)",
  "function getBuyPriceAfterFee(uint256 tokenId, uint256 amount) view returns (uint256)",
  "function getSellPriceAfterFee(uint256 tokenId, uint256 amount) view returns (uint256)",
]);
const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

function byteLength(bytecode: Hex): number {
  return (bytecode.length - 2) / 2;
}

function addressFromStorageWord(word: Hex): Address {
  return getAddress(`0x${word.slice(-40)}`);
}

function minimalProxyImplementation(bytecode: Hex): Address {
  const match = bytecode.match(
    /^0x363d3d373d3d3d363d73([0-9a-fA-F]{40})5af43d82803e903d91602b57fd5bf3$/,
  );
  if (!match?.[1]) throw new Error("akita_creator_coin_not_eip1167_proxy");
  return getAddress(`0x${match[1]}`);
}

async function main(): Promise<void> {
  const rpcUrl =
    process.env.BASE_RPC_URL?.trim() || "https://base-rpc.publicnode.com";
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const [chainId, blockNumber, codeResults] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    Promise.all(
      PINNED_CODE.map(async (dependency) => ({
        ...dependency,
        actual: await client.getBytecode({ address: dependency.address }),
      })),
    ),
  ]);
  if (chainId !== base.id) throw new Error(`chain_id_mismatch:${chainId}`);

  for (const dependency of codeResults) {
    if (!dependency.actual || dependency.actual === "0x") {
      throw new Error(`${dependency.name}_has_no_code`);
    }
    const actualBytes = byteLength(dependency.actual);
    if (actualBytes !== dependency.bytes) {
      throw new Error(`${dependency.name}_code_size_mismatch:${actualBytes}`);
    }
    const actualHash = keccak256(dependency.actual);
    if (actualHash !== dependency.codehash) {
      throw new Error(`${dependency.name}_codehash_mismatch:${actualHash}`);
    }
  }

  const [
    sudoswapOwner,
    sudoswapProtocolFeeMultiplier,
    sudoswapXykAllowed,
    sudoswapRouterStatus,
    sudoswapRouterFactory,
    erc721EthTemplate,
    erc721Erc20Template,
    erc1155EthTemplate,
    erc1155Erc20Template,
  ] = await Promise.all([
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "protocolFeeMultiplier",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "bondingCurveAllowed",
      args: [SUDOSWAP_XYK_CURVE],
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "routerStatus",
      args: [SUDOSWAP_VERY_FAST_ROUTER],
    }),
    client.readContract({
      address: SUDOSWAP_VERY_FAST_ROUTER,
      abi: SUDOSWAP_ROUTER_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "erc721ETHTemplate",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "erc721ERC20Template",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "erc1155ETHTemplate",
    }),
    client.readContract({
      address: SUDOSWAP_FACTORY,
      abi: SUDOSWAP_FACTORY_ABI,
      functionName: "erc1155ERC20Template",
    }),
  ]);
  if (
    sudoswapOwner === getAddress("0x0000000000000000000000000000000000000000")
  ) {
    throw new Error("sudoswap_factory_owner_is_zero");
  }
  if (!sudoswapXykAllowed)
    throw new Error("sudoswap_xyk_curve_not_allowlisted");
  if (!sudoswapRouterStatus[0] || !sudoswapRouterStatus[1]) {
    throw new Error("sudoswap_very_fast_router_not_allowlisted");
  }
  if (getAddress(sudoswapRouterFactory) !== SUDOSWAP_FACTORY) {
    throw new Error("sudoswap_very_fast_router_factory_mismatch");
  }
  const actualTemplates = [
    getAddress(erc721EthTemplate),
    getAddress(erc721Erc20Template),
    getAddress(erc1155EthTemplate),
    getAddress(erc1155Erc20Template),
  ];
  const expectedTemplates = [
    SUDOSWAP_ERC721_ETH_TEMPLATE,
    SUDOSWAP_ERC721_ERC20_TEMPLATE,
    SUDOSWAP_ERC1155_ETH_TEMPLATE,
    SUDOSWAP_ERC1155_ERC20_TEMPLATE,
  ];
  if (
    actualTemplates.some(
      (template, index) => template !== expectedTemplates[index],
    )
  ) {
    throw new Error("sudoswap_pair_template_mismatch");
  }

  const [friendKeyImplementationWord, creatorCoinBytecode] = await Promise.all([
    client.getStorageAt({
      address: FRIEND_KEY,
      slot: EIP1967_IMPLEMENTATION_SLOT,
    }),
    client.getBytecode({ address: AKITA_CREATOR_COIN }),
  ]);
  if (!friendKeyImplementationWord)
    throw new Error("friend_key_implementation_unavailable");
  if (!creatorCoinBytecode)
    throw new Error("akita_creator_coin_bytecode_unavailable");
  const friendKeyImplementation = addressFromStorageWord(
    friendKeyImplementationWord,
  );
  if (friendKeyImplementation !== FRIEND_KEY_IMPLEMENTATION) {
    throw new Error(
      `friend_key_implementation_mismatch:${friendKeyImplementation}`,
    );
  }
  const creatorCoinImplementation =
    minimalProxyImplementation(creatorCoinBytecode);
  if (creatorCoinImplementation !== AKITA_CREATOR_COIN_IMPLEMENTATION) {
    throw new Error(
      `akita_creator_coin_implementation_mismatch:${creatorCoinImplementation}`,
    );
  }

  const [
    roomType,
    roomTier,
    roomCreator,
    roomSupply,
    primaryBuy,
    primarySell,
    name,
    symbol,
    decimals,
    supply,
  ] = await Promise.all([
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "roomTypes",
      args: [ROOM_TOKEN_ID],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "roomTiers",
      args: [ROOM_TOKEN_ID],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "creatorByTokenId",
      args: [ROOM_TOKEN_ID],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "totalSupply",
      args: [ROOM_TOKEN_ID],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "getBuyPriceAfterFee",
      args: [ROOM_TOKEN_ID, 1n],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: "getSellPriceAfterFee",
      args: [ROOM_TOKEN_ID, 1n],
    }),
    client.readContract({
      address: AKITA_CREATOR_COIN,
      abi: ERC20_ABI,
      functionName: "name",
    }),
    client.readContract({
      address: AKITA_CREATOR_COIN,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: AKITA_CREATOR_COIN,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: AKITA_CREATOR_COIN,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    }),
  ]);

  if (roomType !== ROOM_TYPE)
    throw new Error(`room_1659_type_mismatch:${roomType}`);
  if (roomTier !== ROOM_TIER)
    throw new Error(`room_1659_tier_mismatch:${roomTier}`);
  if (getAddress(roomCreator) !== ROOM_CREATOR)
    throw new Error(`room_1659_creator_mismatch:${roomCreator}`);
  if (roomSupply <= 0n) throw new Error("room_1659_has_no_supply");
  if (primaryBuy <= 0n || primarySell <= 0n)
    throw new Error("room_1659_primary_quote_unavailable");
  if (
    name !== "akita" ||
    symbol !== "akita" ||
    decimals !== 18 ||
    supply <= 0n
  ) {
    throw new Error("akita_creator_coin_metadata_mismatch");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        chainId,
        blockNumber: blockNumber.toString(),
        dependencies: codeResults.map(
          ({ name: dependency, address, bytes, codehash }) => ({
            dependency,
            address,
            bytes,
            codehash,
          }),
        ),
        sudoswap: {
          factory: SUDOSWAP_FACTORY,
          owner: getAddress(sudoswapOwner),
          protocolFeeMultiplier: sudoswapProtocolFeeMultiplier.toString(),
          xykCurve: SUDOSWAP_XYK_CURVE,
          veryFastRouter: SUDOSWAP_VERY_FAST_ROUTER,
          templates: expectedTemplates,
        },
        friendKey: {
          address: FRIEND_KEY,
          implementation: friendKeyImplementation,
          tokenId: ROOM_TOKEN_ID.toString(),
          roomType,
          roomTier,
          creator: getAddress(roomCreator),
          totalSupply: roomSupply.toString(),
          oneKeyBuyAfterFee: primaryBuy.toString(),
          oneKeySellAfterFee: primarySell.toString(),
        },
        creatorCoin: {
          address: AKITA_CREATOR_COIN,
          implementation: creatorCoinImplementation,
          name,
          symbol,
          decimals,
          totalSupply: supply.toString(),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
