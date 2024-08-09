import { AlchemyGasManagerConfig } from "@alchemy/aa-alchemy";
import { cookieStorage, createConfig } from "@alchemy/aa-alchemy/config";
import { optimismSepolia } from "viem/chains";

export const chain = optimismSepolia;
export const config = createConfig({
  rpcUrl: "/api/rpc/chain/" + chain.id,
  signerConnection: {
    rpcUrl: "/api/rpc/",
  },
  chain,
  ssr: true,
  storage: cookieStorage,
});

export const gasManagerConfig: AlchemyGasManagerConfig = {
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID!,
};